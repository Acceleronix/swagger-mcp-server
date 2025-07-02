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
			
		} catch (error) {
			console.error('Failed to initialize Swagger MCP Server:', error);
			throw error;
		}
	}

	private registerManagementTools() {
		// List all available APIs
		this.server.tool(
			"list_apis",
			z.object({}),
			async (params: any) => {
				let result = "📋 Available APIs:\n\n";
				
				for (const [name, instance] of this.apiInstances) {
					const spec = instance.swaggerSpec;
					result += `🔗 **${instance.config.title}** (${name})\n`;
					result += `├─ Base URL: ${instance.config.baseUrl}\n`;
					result += `├─ Version: ${spec.info.version}\n`;
					result += `├─ Description: ${spec.info.description?.substring(0, 100) || 'N/A'}...\n`;
					result += `└─ Tools: ${this.getApiToolCount(name)}\n\n`;
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
			z.object({
				message: z.string().describe("Test message")
			}),
			async (params: any) => {
				const { message } = params.input;
				return { 
					content: [{ 
						type: "text", 
						text: `✅ Multi-API Swagger MCP Server is working!\n📩 Message: ${message}\n🔗 Active APIs: ${this.apiInstances.size}` 
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
			
			// Register tools for this API
			await this.registerApiTools(apiInstance);
			
			console.log(`✅ Loaded API: ${apiConfig.title} with ${this.getApiToolCount(apiConfig.name)} tools`);
			
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

	private async registerApiTools(apiInstance: ApiInstance) {
		const { config, swaggerSpec } = apiInstance;
		
		if (!swaggerSpec.paths) {
			console.warn(`No paths found in ${config.name} Swagger spec`);
			return;
		}

		const totalPaths = Object.keys(swaggerSpec.paths).length;
		console.log(`Found ${totalPaths} paths in ${config.name}`);

		let toolCount = 0;
		for (const [path, pathItem] of Object.entries(swaggerSpec.paths)) {
			if (!pathItem || toolCount >= config.maxTools) break;
			
			for (const [method, operation] of Object.entries(pathItem)) {
				if (method === '$ref' || !operation || toolCount >= config.maxTools) continue;

				const op = operation as OpenAPI.Operation;
				const baseOperationId = op.operationId || `${method}_${path.replace(/[{}\/\-]/g, '_')}`;
				const simplifiedOperationId = this.simplifyOperationId(baseOperationId);
				const toolName = `${config.name}_${simplifiedOperationId}`;
				
				console.log(`Register: ${toolName} [${method.toUpperCase()} ${path}]`);

				// Create input schema with auth support
				const inputSchema = this.createInputSchema(apiInstance, op);

				// Create tool description with actual API path and method
				const toolDescription = `${op.summary || `Call ${method.toUpperCase()} ${path}`}\n\n` +
					`🔗 **API Endpoint**: ${method.toUpperCase()} ${path}\n` +
					`📝 **Description**: ${op.description || 'No description available'}\n` +
					`🏷️ **Tool Name**: ${toolName}`;

				this.server.tool(
					toolName,
					inputSchema.describe(toolDescription),
					async (params: any) => {
						return await this.executeApiCall(apiInstance, path, method, op, params.input);
					}
				);
				toolCount++;
			}
		}
		
		console.log(`Registered ${toolCount} tools for ${config.name}`);
	}

	private simplifyOperationId(operationId: string): string {
		// Remove redundant HTTP method suffixes
		let simplified = operationId
			.replace(/Using(GET|POST|PUT|DELETE|PATCH)(_\d+)?$/g, '')
			.replace(/Controller$/g, '');

		// Apply specific mappings for common patterns
		const mappings: Record<string, string> = {
			// Device management
			'deviceDetail': 'device_detail',
			'deviceList': 'device_list',
			'verifiedDevice': 'verify_device',
			'addSnList': 'add_sn_list',
			'deleteSnList': 'delete_sn_list',
			'findDkList': 'find_dk_list',
			'findSnList': 'find_sn_list',
			'generateSnList': 'generate_sn_list',
			
			// App service
			'appQueryProductPanel': 'query_product_panel',
			'appReportingCapability': 'reporting_capability',
			'appRequestPanelByPk': 'request_panel_by_pk',
			'guidanceDetail': 'guidance_detail',
			'itemList': 'item_list',
			'setting': 'get_setting',
			
			// Binding operations
			'batchControlDevice': 'batch_control_device',
			'batchGetPureBtResetCredentials': 'batch_get_bt_reset_credentials',
			'batchUnbindlingDevice': 'batch_unbind_device',
			'bind3rdMatterDevice': 'bind_matter_device',
			'bindDeviceBt': 'bind_device_bt',
			'bindDeviceDk': 'bind_device_dk',
			'bindDeviceByPkDk': 'bind_device_by_pk_dk',
			'deviceUserList': 'device_user_list',
			'getUserListByBind': 'get_user_list_by_bind',
			'unbundlingUserDevice': 'unbind_user_device',
			'userDeviceList': 'user_device_list',
			'verifyBindingCode': 'verify_binding_code',
			
			// Device group
			'acceptDeviceGroupShare': 'accept_group_share',
			'addDeviceGroup': 'add_device_group',
			'addDeviceToGroup': 'add_device_to_group',
			'deleteDeviceGroup': 'delete_device_group',
			'deleteDeviceToGroup': 'remove_device_from_group',
			
			// Device shadow
			'getLocation': 'get_location',
			'sendData': 'send_data',
			'batchSendData': 'batch_send_data',
			'deviceResource': 'device_resource',
			'sendData2': 'send_data_v2',
			'readData': 'read_data',
			
			// User operations
			'addConsentRecord': 'add_consent_record',
			'addReasonCancellation': 'add_reason_cancellation',
			'alipayAuthLogin': 'alipay_auth_login',
			'appLogUpload': 'app_log_upload',
			'appleAuthLogin': 'apple_auth_login',
			
			// Product operations
			'productDetail': 'product_detail',
			'overviewProjects': 'overview_projects',
			'overviewProducts': 'overview_products',
			'products': 'products',
			'openApiProductDetailV3': 'open_api_product_detail_v3',
			
			// OTA operations
			'addDeviceUpgrade': 'add_device_upgrade',
			'closeFinishTips': 'close_finish_tips',
			'deleteDeviceUpgrade': 'delete_device_upgrade',
			'getAutoUpgradeSwitch': 'get_auto_upgrade_switch',
			'getDeviceUpgradePlan': 'get_device_upgrade_plan',
			
			// Data storage
			'getZhxyPropertyDataList': 'get_zhxy_property_data_list',
			'getDeviceEventList': 'get_device_event_list',
			'getLocationHistory': 'get_location_history',
			'getPropertyChartList': 'get_property_chart_list',
			'getPropertyDataList': 'get_property_data_list',
			
			// Weather operations
			'deviceLocationDelete': 'delete_device_location',
			'deviceLocationFind': 'find_device_location',
			'deviceLocationSave': 'save_device_location',
			'obtainCurrentWeatherOnDk': 'get_current_weather'
		};

		// Apply mapping if exists
		if (mappings[simplified]) {
			return mappings[simplified];
		}

		// Convert camelCase to snake_case for remaining cases
		return simplified
			.replace(/([A-Z])/g, '_$1')
			.toLowerCase()
			.replace(/^_/, '')  // Remove leading underscore
			.replace(/_+/g, '_'); // Replace multiple underscores with single
	}

	private createInputSchema(apiInstance: ApiInstance, operation: OpenAPI.Operation): z.ZodObject<any> {
		const { config } = apiInstance;
		
		// Base schema with auth
		const schemaFields: any = {};
		
		// Add auth field based on API configuration
		if (config.auth) {
			switch (config.auth.type) {
				case 'bearer':
					schemaFields.auth_token = z.string().optional().describe("Bearer token for authentication");
					break;
				case 'apiKey':
					schemaFields.api_key = z.string().optional().describe(`API key for ${config.auth.apiKeyName || 'authentication'}`);
					break;
				case 'basic':
					schemaFields.username = z.string().optional().describe("Username for basic auth");
					schemaFields.password = z.string().optional().describe("Password for basic auth");
					break;
			}
		}

		// Add operation-specific parameters (simplified for now)
		const parameters = operation.parameters || [];
		parameters.forEach((param: any) => {
			if (param && param.name) {
				schemaFields[param.name] = z.string().optional().describe(param.description || `Parameter: ${param.name}`);
			}
		});

		return z.object(schemaFields);
	}

	private async executeApiCall(
		apiInstance: ApiInstance, 
		path: string, 
		method: string, 
		operation: OpenAPI.Operation, 
		input: any
	): Promise<any> {
		const { config } = apiInstance;
		
		try {
			// Build headers
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			// Add authentication
			this.addAuthHeaders(headers, config, input);

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
						{ type: "text", text: `🌐 **Full URL**: ${url}` },
						{ type: "text", text: `📊 **Status**: ${error.response.status}` },
						{ type: "text", text: `❌ **Error Response**:\n\`\`\`json\n${JSON.stringify(error.response.data, null, 2)}\n\`\`\`` }
					]
				};
			}
			return {
				content: [
					{ type: "text", text: `❌ **${config.title}** API Call Failed` },
					{ type: "text", text: `🔗 **Endpoint**: ${method.toUpperCase()} ${path}` },
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

	private getApiToolCount(apiName: string): number {
		// Count tools that start with the API name prefix
		// This is a simplified count - in real implementation we'd track this properly
		return 5; // Placeholder
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

		// Serve config.json (removed for now)
		if (url.pathname === "/config.json") {
			return new Response('{"error": "Config endpoint disabled"}', {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response("Swagger MCP Server - Not found", { status: 404 });
	},
};
