import { SwaggerMcpServer } from "./mcp-server";
import { loadConfig } from "./config";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Simplified approach for Workers - directly instantiate the server
let swaggerServer: SwaggerMcpServer | null = null;

async function initializeSwaggerServer() {
	if (swaggerServer) return swaggerServer;
	
	try {
		console.log('Initializing Swagger MCP Server...');
		
		// Load configuration - in Workers we'll use default for now
		const config = await loadConfig();
		
		// Create Swagger MCP server instance
		swaggerServer = new SwaggerMcpServer(
			config.swagger.apiBaseUrl, 
			config.swagger.defaultAuth
		);
		
		// Load the Swagger specification
		await swaggerServer.loadSwaggerSpec(config.swagger.url);
		
		console.log('Swagger MCP Server initialized successfully');
		return swaggerServer;
	} catch (error) {
		console.error('Failed to initialize Swagger MCP Server:', error);
		throw error;
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

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

		// SSE endpoint for MCP connection
		if (url.pathname === "/sse") {
			if (request.method === "GET") {
				// Simple SSE response for now
				return new Response("data: {\"type\":\"hello\",\"message\":\"MCP Server Ready\"}\n\n", {
					headers: {
						'Content-Type': 'text/event-stream',
						'Cache-Control': 'no-cache',
						'Connection': 'keep-alive',
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type'
					}
				});
			} else if (request.method === "POST") {
				// Handle incoming MCP messages
				try {
					const body = await request.text();
					console.log('Received MCP message:', body);
					
					return new Response(JSON.stringify({ status: "received" }), {
						headers: { 
							'Content-Type': 'application/json',
							'Access-Control-Allow-Origin': '*'
						}
					});
				} catch (error) {
					console.error('SSE POST error:', error);
					return new Response(JSON.stringify({
						error: 'Failed to handle message',
						message: error instanceof Error ? error.message : 'Unknown error'
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			}
		}

		// Initialize server on first request
		try {
			const server = await initializeSwaggerServer();
			
			// Basic endpoint to show server is ready
			if (url.pathname === "/api/info") {
				return new Response(JSON.stringify({
					service: 'Swagger MCP Server',
					status: 'ready',
					endpoints: ['health', 'sse', 'api/info']
				}), {
					headers: { 'Content-Type': 'application/json' }
				});
			}

		} catch (error) {
			return new Response(JSON.stringify({
				error: 'Failed to initialize server',
				message: error instanceof Error ? error.message : 'Unknown error'
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response("Swagger MCP Server - Not found", { status: 404 });
	},
};
