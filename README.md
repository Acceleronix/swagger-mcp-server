# Acceleronix OpenAPI Swagger Doc MCP Server

A comprehensive Model Context Protocol (MCP) server that provides seamless access to **32 OpenAPIs** from the [Acceleronix Developer Center](https://). Built on Cloudflare Workers with intelligent tool management and Bearer token authentication.

## Features

- **32 Acceleronix PaaS OpenAPIs**: Comprehensive coverage of device management, data storage, family services, and more
- **Smart Tool Management**: Intelligent load balancing with 3-8 tools per API (~100 tools total)
- **Multi-Tier Architecture**: EndUser, Enterprise, and Open API access levels
- **Bearer Token Auth**: Unified authentication across all APIs
- **Real-time Access**: Deployed on Cloudflare Workers for global low-latency access
- **Claude Integration**: Direct integration with Claude Desktop and AI Playground

## Supported API Categories

### **Core Device Management** (18 Enabled APIs)
- **Device Manager (Enterprise)** - Device lifecycle and configuration management
- **Device Shadow (Enterprise)** - Device state synchronization and shadow operations
- **Binding Service (EndUser/Enterprise)** - Device binding and user association
- **DeviceGroup Service (EndUser)** - Group management and batch operations

### **Platform Services**
- **App Service (EndUser)** - Application management and deployment
- **Family Service (EndUser)** - Multi-user family account management
- **EndUser Service (EndUser)** - User profile and account operations
- **Product Management (Enterprise)** - Product catalog and lifecycle

### **Data & Analytics**
- **Data Storage (EndUser)** - Time-series data storage and retrieval
- **Weather Service (EndUser)** - Weather data integration
- **Rule Engine (EndUser)** - Event processing and automation rules
- **Category Management (EndUser)** - Device categorization and taxonomy

### **Infrastructure Services**
- **OTA Service (EndUser)** - Over-the-air firmware updates
- **Thing Specification Language (Enterprise)** - Device model definitions
- **Matter Service (EndUser)** - Matter protocol integration
- **I18n Service (EndUser)** - Internationalization and localization
- **Global Bootstrap (Open)** - Platform initialization services

### **Additional APIs** (14 Available, Currently Disabled)
- Mail Service, Mobile Push, OEM App, Portal Service, Work Order, SMS, Streaming Media, and more

## Quick Start

### Deploy to Cloudflare Workers

```bash
# Clone the repository
git clone <repository-url>
cd swagger-mcp-server

# Install dependencies
npm install

# Deploy to Cloudflare Workers
npm run deploy
```

Your MCP server will be available at: `https://swagger-mcp-server.<your-account>.workers.dev/sse`

### Local Development

```bash
# Start local development server
npm run dev

# Server available at: http://localhost:8787/sse
```

## Configuration

### Bearer Token Setup

Update the authentication tokens in `src/config.ts`:

```typescript
{
  name: "device_mgr_enterprise",
  title: "IoT Device Manager (Enterprise)",
  auth: { type: 'bearer', token: 'your-bearer-token-here' },
  enabled: true,
  maxTools: 8
}
```

### Enable/Disable APIs

Control which APIs are active by modifying the `enabled` flag:

```json
{
  "name": "mail_enduser",
  "title": "Mail Service (EndUser)",
  "enabled": false,  // Set to true to enable
  "maxTools": 4
}
```

## Claude Desktop Integration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "iot-apis": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://swagger-mcp-server.your-account.workers.dev/sse"
      ]
    }
  }
}
```

## Available Tools

The server automatically generates tools from Swagger specifications with intelligent naming:

- `device_mgr_enterprise_getDevices` - List all devices
- `binding_enduser_bindDevice` - Bind device to user
- `deviceshadow_enterprise_updateShadow` - Update device shadow
- `weather_enduser_getCurrentWeather` - Get current weather data
- And ~96 more tools across all enabled APIs

## Management Tools

### List Available APIs
```bash
# Using Claude
"List all available APIs and their status"
```

### Test Connection
```bash
# Using Claude  
"Test the MCP server connection"
```

## Architecture

```
Claude Desktop/AI Playground
           ↓
    MCP JSON-RPC 2.0
           ↓
   Cloudflare Workers
           ↓
    McpAgent (Durable Objects)
           ↓
   Multi-API Tool Router
           ↓
    32 IoT APIs (Acceleronix)
```

## Tool Distribution Strategy

- **High Priority APIs**: 6-8 tools each (Device Management, Product, TSL)
- **Medium Priority APIs**: 4-6 tools each (Binding, Shadow, Data Storage)
- **Utility APIs**: 3-4 tools each (Weather, I18n, Bootstrap)
- **Total**: ~100 tools across 18 enabled APIs

## Security Features

- Bearer token authentication for all API calls
- Environment variable support for sensitive tokens
- CORS-enabled for browser clients
- Request validation and error handling

## Endpoints

- **MCP SSE**: `/sse` - Server-Sent Events endpoint for Claude
- **Health Check**: `/health` - Service status and version info
- **MCP JSON-RPC**: `/mcp` - Direct JSON-RPC 2.0 endpoint

## PI Documentation

Each API provides comprehensive Swagger documentation accessible through the tools. Use the `list_apis` tool to see all available APIs and their descriptions.

## Contributing

1. Fork the repository
2. Add new APIs to `src/config.ts`
3. Test locally with `npm run dev`
4. Deploy and test with Claude Desktop
5. Submit a pull request

## License

MIT License - see LICENSE file for details 
