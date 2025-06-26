import { z } from 'zod';

// Define authentication schema
const AuthConfigSchema = z.object({
  type: z.enum(['basic', 'bearer', 'apiKey', 'oauth2']),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  apiKeyName: z.string().optional(),
  apiKeyIn: z.enum(['header', 'query']).optional(),
}).optional();

// Define API configuration schema
const ApiConfigSchema = z.object({
  name: z.string().describe("Unique identifier for this API"),
  title: z.string().describe("Human-readable title for this API"),
  swaggerUrl: z.string().url().describe("URL to the Swagger/OpenAPI specification"),
  baseUrl: z.string().url().describe("Base URL for API calls"),
  auth: AuthConfigSchema,
  enabled: z.boolean().default(true).describe("Whether this API is enabled"),
  maxTools: z.number().default(10).describe("Maximum number of tools to register from this API"),
});

// Define the main configuration schema
export const ConfigSchema = z.object({
  apis: z.array(ApiConfigSchema).min(1).describe("Array of API configurations"),
  log: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
  }),
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;

const defaultConfig: Config = {
  apis: [
    {
      name: "iot_device_mgr",
      title: "IoT Device Manager API",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/devicemgr/v2/api-docs?group=device-mgr-enterpriseapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/devicemgr",
      auth: {
        type: 'bearer',
        token: '',
      },
      enabled: true,
      maxTools: 15
    },
    {
      name: "petstore",
      title: "Pet Store API (Demo)",
      swaggerUrl: "https://petstore.swagger.io/v2/swagger.json",
      baseUrl: "https://petstore.swagger.io/v2",
      auth: {
        type: 'apiKey',
        apiKey: 'special-key',
        apiKeyName: 'api_key',
        apiKeyIn: 'header',
      },
      enabled: false, // Disabled by default
      maxTools: 5
    }
  ],
  log: {
    level: 'info',
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
};

export async function loadConfig(configData?: any): Promise<Config> {
  try {
    // In Workers environment, we expect config to be passed in or use default
    const config = configData || defaultConfig;
    return ConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Invalid configuration:', error.errors);
    } else {
      console.error('Error loading configuration:', error);
    }
    console.log('Using default configuration');
    return defaultConfig;
  }
} 