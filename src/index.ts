import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig, ApiConfig, AuthConfig } from "./config";
import axios from "axios";
import SwaggerParser from "@apidevtools/swagger-parser";
import { OpenAPI } from "openapi-types";
import { SecurityScheme } from './types.js';

// Interface for API instance
interface ApiInstance {
	config: ApiConfig;
	swaggerSpec: OpenAPI.Document;
	securitySchemes: Record<string, SecurityScheme>;
}

// Define our Swagger MCP agent following the reference pattern
export class SwaggerMCP extends McpAgent {
	server = new McpServer({
		name: "Multi-API Swagger MCP Server",
		version: "2.0.0",
	}) as any;

	private apiInstances: Map<string, ApiInstance> = new Map();
	private allEndpoints: Array<{
		apiName: string;
		apiTitle: string;
		method: string;
		path: string;
		operationId?: string;
		summary?: string;
		description?: string;
		parameters?: any[];
		operation: any;
	}> = [];

	async init() {
		try {
			console.log('Initializing Multi-API Swagger MCP Server...');
			
			// Load configuration
			const config = await loadConfig();
			
			// Register management tools first
			this.registerManagementTools();
			
			// Initialize all enabled APIs
			for (const apiConfig of config.apis) {
				if (apiConfig.enabled) {
					await this.initializeApi(apiConfig);
				} else {
					console.log(`Skipping disabled API: ${apiConfig.name}`);
				}
			}
			
			console.log(`Swagger MCP Server initialized with ${this.apiInstances.size} APIs`);
			console.log(`Total endpoints collected: ${this.allEndpoints.length}`);
			
		} catch (error) {
			console.error('Failed to initialize Swagger MCP Server:', error);
			throw error;
		}
	}

	private registerManagementTools() {
		// List all available APIs
		this.server.tool(
			"list_apis",
			"List all available APIs",
			{
				input: z.object({})
			},
			async () => {
				let result = "📋 Available APIs:\n\n";
				
				for (const [name, instance] of this.apiInstances) {
					const spec = instance.swaggerSpec;
					result += `🔗 **${instance.config.title}** (${name})\n`;
					result += `├─ Base URL: ${instance.config.baseUrl}\n`;
					result += `├─ Version: ${spec.info.version}\n`;
					result += `├─ Description: ${spec.info.description?.substring(0, 100) || 'N/A'}...\n`;
					result += `└─ Endpoints: ${this.getApiEndpointCount(name)}\n\n`;
				}
				
				if (this.apiInstances.size === 0) {
					result = "❌ No APIs are currently loaded.";
				}
				
				return { 
					content: [{ type: "text", text: result }] 
				};
			}
		);

		// Test tool
		this.server.tool(
			"test_connection",
			"Test connection to the MCP server",
			{
				input: z.object({
					message: z.string().describe("Test message")
				})
			},
			async ({ input }: any) => {
				const { message } = input;
				return { 
					content: [{ 
						type: "text", 
						text: `✅ Multi-API Swagger MCP Server is working!\n📩 Message: ${message}\n🔗 Active APIs: ${this.apiInstances.size}\n📊 Total Endpoints: ${this.allEndpoints.length}` 
					}] 
				};
			}
		);

		// Search and call API tool
		this.server.tool(
			"search_api",
			"Search for API endpoints or call a specific API",
			{
				input: z.object({
					query: z.string().optional().describe("Search query to find matching API endpoints (e.g., 'product', 'device', 'user')"),
					api_name: z.string().optional().describe("API name to call (e.g., 'product_enterprise', 'device_mgr_enterprise')"),
					method: z.string().optional().describe("HTTP method (GET, POST, PUT, DELETE)"),
					path: z.string().optional().describe("API endpoint path (e.g., '/v2/project/{projectId}/product/overview')"),
					parameters: z.record(z.any()).optional().describe("API parameters as key-value pairs"),
					auth_token: z.string().optional().describe("Bearer token for authentication")
				})
			},
			async ({ input }: any) => {
				const { query, api_name, method, path, parameters, auth_token } = input;
				
				// Search mode: find matching endpoints
				if (query && !api_name && !method && !path) {
					return await this.searchEndpoints(query);
				}
				
				// Call mode: execute specific API
				if (api_name && method && path) {
					return await this.callEndpoint(api_name, method, path, parameters || {}, auth_token);
				}
				
				// Invalid usage
				return {
					content: [{
						type: "text",
						text: `❌ **Invalid Usage**\n\n` +
							`**Search Mode**: Provide only \`query\` parameter\n` +
							`Example: {"query": "product"}\n\n` +
							`**Call Mode**: Provide \`api_name\`, \`method\`, and \`path\`\n` +
							`Example: {"api_name": "product_enterprise", "method": "GET", "path": "/v2/project/{projectId}/product/overview", "parameters": {"projectId": "123"}}`
					}]
				};
			}
		);
	}

	private async initializeApi(apiConfig: ApiConfig) {
		try {
			console.log(`Loading API: ${apiConfig.title} (${apiConfig.name})`);
			
			// Load Swagger specification
			const swaggerSpec = await SwaggerParser.parse(apiConfig.swaggerUrl) as OpenAPI.Document;
			
			// Extract security schemes
			const securitySchemes = this.extractSecuritySchemes(swaggerSpec);
			
			// Create API instance
			const apiInstance: ApiInstance = {
				config: apiConfig,
				swaggerSpec,
				securitySchemes
			};
			
			// Store the instance
			this.apiInstances.set(apiConfig.name, apiInstance);
			
			// Collect endpoints for this API
			await this.collectApiEndpoints(apiInstance);
			
			console.log(`✅ Loaded API: ${apiConfig.title} with ${this.getApiEndpointCount(apiConfig.name)} endpoints`);
			
		} catch (error) {
			console.error(`❌ Failed to load API ${apiConfig.name}:`, error);
			// Continue with other APIs even if one fails
		}
	}

	private extractSecuritySchemes(swaggerSpec: OpenAPI.Document): Record<string, SecurityScheme> {
		// OpenAPI 3.x
		const components = (swaggerSpec as any).components;
		if (components && components.securitySchemes) {
			return components.securitySchemes;
		}

		// Swagger 2.0
		const securityDefinitions = (swaggerSpec as any).securityDefinitions;
		if (securityDefinitions) {
			return securityDefinitions;
		}

		return {};
	}

	private async collectApiEndpoints(apiInstance: ApiInstance) {
		const { config, swaggerSpec } = apiInstance;
		
		if (!swaggerSpec.paths) {
			console.warn(`No paths found in ${config.name} Swagger spec`);
			return;
		}

		const totalPaths = Object.keys(swaggerSpec.paths).length;
		console.log(`Found ${totalPaths} paths in ${config.name}`);

		let endpointCount = 0;
		for (const [path, pathItem] of Object.entries(swaggerSpec.paths)) {
			if (!pathItem || endpointCount >= config.maxTools) break;
			
			for (const [method, operation] of Object.entries(pathItem)) {
				if (method === '$ref' || !operation || endpointCount >= config.maxTools) continue;

				const op = operation as OpenAPI.Operation;
				
				// Store endpoint information for search functionality
				this.allEndpoints.push({
					apiName: config.name,
					apiTitle: config.title,
					method: method.toUpperCase(),
					path: path,
					operationId: op.operationId,
					summary: op.summary,
					description: op.description,
					parameters: op.parameters || [],
					operation: op
				});
				
				console.log(`Collected: ${config.name} [${method.toUpperCase()} ${path}] - ${op.summary || 'No summary'}`);
				endpointCount++;
			}
		}
		
		console.log(`Collected ${endpointCount} endpoints for ${config.name}`);
	}

	private async searchEndpoints(query: string): Promise<any> {
		const searchQuery = query.toLowerCase();
		const matchingEndpoints = this.allEndpoints.filter(endpoint => {
			const searchableText = [
				endpoint.path,
				endpoint.summary,
				endpoint.description,
				endpoint.operationId,
				endpoint.apiTitle,
				endpoint.apiName
			].join(' ').toLowerCase();
			
			return searchableText.includes(searchQuery);
		});

		if (matchingEndpoints.length === 0) {
			return {
				content: [{
					type: "text",
					text: `🔍 **No endpoints found for query: "${query}"**\n\n` +
						`Try searching for terms like: product, device, user, binding, group, etc.`
				}]
			};
		}

		let result = `🔍 **Found ${matchingEndpoints.length} matching endpoints for "${query}":**\n\n`;
		
		matchingEndpoints.slice(0, 10).forEach((endpoint, index) => {
			result += `**${index + 1}. ${endpoint.apiTitle}**\n`;
			result += `🔗 **Endpoint**: \`${endpoint.method} ${endpoint.path}\`\n`;
			result += `📝 **Summary**: ${endpoint.summary || 'No summary'}\n`;
			result += `📋 **Description**: ${endpoint.description || 'No description'}\n`;
			result += `🏷️ **API Name**: ${endpoint.apiName}\n`;
			if (endpoint.parameters && endpoint.parameters.length > 0) {
				const paramNames = endpoint.parameters.map((p: any) => p.name).join(', ');
				result += `📥 **Parameters**: ${paramNames}\n`;
			}
			result += `\n**To call this endpoint, use:**\n`;
			result += `\`\`\`json\n`;
			result += `{\n`;
			result += `  "api_name": "${endpoint.apiName}",\n`;
			result += `  "method": "${endpoint.method}",\n`;
			result += `  "path": "${endpoint.path}",\n`;
			result += `  "parameters": {},\n`;
			result += `  "auth_token": "your-token-here"\n`;
			result += `}\n`;
			result += `\`\`\`\n\n`;
		});

		if (matchingEndpoints.length > 10) {
			result += `*Showing first 10 results. Total found: ${matchingEndpoints.length}*`;
		}

		return {
			content: [{ type: "text", text: result }]
		};
	}

	private async callEndpoint(apiName: string, method: string, path: string, parameters: any, authToken?: string): Promise<any> {
		// Find the API instance
		const apiInstance = this.apiInstances.get(apiName);
		if (!apiInstance) {
			return {
				content: [{
					type: "text",
					text: `❌ **API not found**: ${apiName}\n\n` +
						`Available APIs: ${Array.from(this.apiInstances.keys()).join(', ')}`
				}]
			};
		}

		// Find the matching endpoint
		const endpoint = this.allEndpoints.find(ep => 
			ep.apiName === apiName && 
			ep.method === method.toUpperCase() && 
			ep.path === path
		);

		if (!endpoint) {
			return {
				content: [{
					type: "text",
					text: `❌ **Endpoint not found**: ${method.toUpperCase()} ${path}\n\n` +
						`API: ${apiName}\n` +
						`Use search_api with a query to find available endpoints.`
				}]
			};
		}

		// Prepare auth configuration
		const authConfig = { ...apiInstance.config.auth };
		if (authToken) {
			authConfig.token = authToken;
		}

		// Execute the API call
		try {
			return await this.executeApiCall(apiInstance, path, method.toLowerCase(), endpoint.operation, parameters, authConfig);
		} catch (error) {
			return {
				content: [{
					type: "text",
					text: `❌ **API Call Failed**\n` +
						`🔗 **Endpoint**: ${method.toUpperCase()} ${path}\n` +
						`🏷️ **API**: ${apiInstance.config.title}\n` +
						`❌ **Error**: ${error}`
				}]
			};
		}
	}

	private async executeApiCall(
		apiInstance: ApiInstance, 
		path: string, 
		method: string, 
		operation: OpenAPI.Operation, 
		input: any,
		authOverride?: any
	): Promise<any> {
		const { config } = apiInstance;
		
		try {
			// Build headers
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			// Add authentication (use authOverride if provided)
			const effectiveConfig = { ...config };
			if (authOverride) {
				effectiveConfig.auth = authOverride;
			}
			this.addAuthHeaders(headers, effectiveConfig, input);

			// Build URL
			let url = config.baseUrl + path;
			
			// Handle path parameters (simplified)
			Object.entries(input).forEach(([key, value]) => {
				if (typeof value === 'string' && url.includes(`{${key}}`)) {
					url = url.replace(`{${key}}`, encodeURIComponent(value));
				}
			});

			// Execute request
			const response = await axios({
				method: method as string,
				url: url,
				headers,
				// Add query params or body based on method
				...(method.toLowerCase() === 'get' ? 
					{ params: this.extractQueryParams(input) } : 
					{ data: this.extractBodyParams(input) }
				)
			});

			return {
				content: [
					{ type: "text", text: `✅ **${config.title}** API Call Successful` },
					{ type: "text", text: `🔗 **Endpoint**: ${method.toUpperCase()} ${path}` },
					{ type: "text", text: `🌐 **Full URL**: ${url}` },
					{ type: "text", text: `📊 **Status**: ${response.status}` },
					{ type: "text", text: `📄 **Response**:\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\`` }
				]
			};
		} catch (error) {
			console.error(`Error in ${config.name} API call:`, error);
			if (axios.isAxiosError(error) && error.response) {
				return {
					content: [
						{ type: "text", text: `❌ **${config.title}** API Call Failed` },
						{ type: "text", text: `🔗 **Endpoint**: ${method.toUpperCase()} ${path}` },
						{ type: "text", text: `🌐 **Full URL**: ${config.baseUrl}${path}` },
						{ type: "text", text: `📊 **Status**: ${error.response.status}` },
						{ type: "text", text: `❌ **Error Response**:\n\`\`\`json\n${JSON.stringify(error.response.data, null, 2)}\n\`\`\`` }
					]
				};
			}
			return {
				content: [
					{ type: "text", text: `❌ **${config.title}** API Call Failed` },
					{ type: "text", text: `🔗 **Endpoint**: ${method.toUpperCase()} ${path}` },
					{ type: "text", text: `🌐 **Base URL**: ${config.baseUrl}` },
					{ type: "text", text: `❌ **Error**: ${error}` }
				]
			};
		}
	}

	private addAuthHeaders(headers: Record<string, string>, config: ApiConfig, input: any) {
		const auth = config.auth;
		if (!auth) return;

		switch (auth.type) {
			case 'bearer':
				const token = input.auth_token || auth.token;
				if (token) {
					headers['Authorization'] = `Bearer ${token}`;
				}
				break;
			case 'apiKey':
				const apiKey = input.api_key || auth.apiKey;
				if (apiKey && auth.apiKeyName) {
					if (auth.apiKeyIn === 'header') {
						headers[auth.apiKeyName] = apiKey;
					}
					// Query params handled elsewhere
				}
				break;
			case 'basic':
				const username = input.username || auth.username;
				const password = input.password || auth.password;
				if (username && password) {
					const credentials = btoa(`${username}:${password}`);
					headers['Authorization'] = `Basic ${credentials}`;
				}
				break;
		}
	}

	private extractQueryParams(input: any): Record<string, any> {
		// Filter out auth parameters and return the rest as query params
		const excluded = ['auth_token', 'api_key', 'username', 'password'];
		const params: Record<string, any> = {};
		
		Object.entries(input).forEach(([key, value]) => {
			if (!excluded.includes(key) && value !== undefined && value !== '') {
				params[key] = value;
			}
		});
		
		return params;
	}

	private extractBodyParams(input: any): Record<string, any> {
		return this.extractQueryParams(input); // Same logic for now
	}

	private getApiEndpointCount(apiName: string): number {
		// Count endpoints for this API
		return this.allEndpoints.filter(ep => ep.apiName === apiName).length;
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Handle SSE endpoint using the McpAgent pattern
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return SwaggerMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		// Handle MCP endpoint
		if (url.pathname === "/mcp") {
			return SwaggerMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Health check endpoint
		if (url.pathname === "/health") {
			return new Response(JSON.stringify({ 
				status: 'ok', 
				service: 'Swagger MCP Server',
				version: '2.0.0'
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response("Swagger MCP Server - Not found", { status: 404 });
	},
};