import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig } from "./config";
import axios from "axios";
import SwaggerParser from "@apidevtools/swagger-parser";
import { OpenAPI } from "openapi-types";
import { AuthConfig, ToolInput, SecurityScheme } from './types.js';

// Define our Swagger MCP agent following the reference pattern
export class SwaggerMCP extends McpAgent {
	server = new McpServer({
		name: "Swagger API MCP Server",
		version: "1.0.0",
	}) as any;

	private swaggerSpec: OpenAPI.Document | null = null;
	private apiBaseUrl: string = "";
	private defaultAuth: AuthConfig | undefined;
	private securitySchemes: Record<string, SecurityScheme> = {};

	async init() {
		try {
			console.log('Initializing Swagger MCP Server...');
			
			// Load configuration
			const config = await loadConfig();
			this.apiBaseUrl = config.swagger.apiBaseUrl;
			this.defaultAuth = config.swagger.defaultAuth;
			
			// Load the Swagger specification
			await this.loadSwaggerSpec(config.swagger.url);
			
			// Register tools based on the Swagger spec
			await this.registerSwaggerTools();
			
			console.log('Swagger MCP Server initialized successfully');
			
		} catch (error) {
			console.error('Failed to initialize Swagger MCP Server:', error);
			throw error;
		}
	}

	private async loadSwaggerSpec(specUrl: string) {
		console.log('Loading Swagger specification from:', specUrl);
		try {
			this.swaggerSpec = await SwaggerParser.parse(specUrl) as OpenAPI.Document;
			
			const info = this.swaggerSpec.info;
			console.log('Loaded Swagger spec:', {
				title: info.title,
				version: info.version,
				description: info.description?.substring(0, 100) + '...'
			});
			
			// Extract security schemes
			this.extractSecuritySchemes();
			console.log('Security schemes found:', Object.keys(this.securitySchemes));
			
		} catch (error) {
			console.error("Failed to load Swagger specification:", error);
			throw error;
		}
	}

	private extractSecuritySchemes() {
		if (!this.swaggerSpec) return;

		// OpenAPI 3.x
		const components = (this.swaggerSpec as any).components;
		if (components && components.securitySchemes) {
			this.securitySchemes = components.securitySchemes;
			return;
		}

		// Swagger 2.0
		const securityDefinitions = (this.swaggerSpec as any).securityDefinitions;
		if (securityDefinitions) {
			this.securitySchemes = securityDefinitions;
		}
	}

	private async registerSwaggerTools() {
		console.log('Starting tool registration process');
		if (!this.swaggerSpec || !this.swaggerSpec.paths) {
			console.warn('No paths found in Swagger spec');
			return;
		}

		const totalPaths = Object.keys(this.swaggerSpec.paths).length;
		console.log(`Found ${totalPaths} paths to process`);

		// Register a test tool first
		this.server.tool(
			"swagger_test",
			z.object({
				message: z.string().describe("Test message")
			}),
			async (params: any) => {
				const { message } = params.input;
				return { 
					content: [{ 
						type: "text", 
						text: `Swagger MCP Server is working! Message: ${message}` 
					}] 
				};
			}
		);

		// Register tools for first few endpoints as examples
		let toolCount = 0;
		for (const [path, pathItem] of Object.entries(this.swaggerSpec.paths)) {
			if (!pathItem || toolCount >= 5) break; // Limit to 5 tools for now
			
			for (const [method, operation] of Object.entries(pathItem)) {
				if (method === '$ref' || !operation || toolCount >= 5) continue;

				const op = operation as OpenAPI.Operation;
				const operationId = op.operationId || `${method}-${path.replace(/[{}\/]/g, '_')}`;
				
				console.log(`Register endpoint: ${method.toUpperCase()} ${path} (${operationId})`);

				// Create simple input schema
				const inputSchema = z.object({
					auth_token: z.string().optional().describe("Bearer token for authentication")
				});

				this.server.tool(
					operationId,
					inputSchema,
					async (params: any) => {
						const { auth_token } = params.input;
						try {
							const headers: Record<string, string> = {
								'Content-Type': 'application/json'
							};

							if (auth_token) {
								headers['Authorization'] = `Bearer ${auth_token}`;
							}

							const url = this.apiBaseUrl + path;
							const response = await axios({
								method: method as string,
								url: url,
								headers
							});

							return {
								content: [
									{ type: "text", text: JSON.stringify(response.data, null, 2) },
									{ type: "text", text: `HTTP Status: ${response.status}` }
								]
							};
						} catch (error) {
							console.error(`Error in ${operationId}:`, error);
							if (axios.isAxiosError(error) && error.response) {
								return {
									content: [{ 
										type: "text", 
										text: `Error ${error.response.status}: ${JSON.stringify(error.response.data, null, 2)}` 
									}]
								};
							}
							return {
								content: [{ type: "text", text: `Error: ${error}` }]
							};
						}
					}
				);
				toolCount++;
			}
		}
		
		console.log(`Registered ${toolCount} tools from Swagger spec`);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
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
				version: '1.0.0'
			}), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response("Swagger MCP Server - Not found", { status: 404 });
	},
};
