import { z } from 'zod';

// Define the configuration schema
export const ConfigSchema = z.object({
  swagger: z.object({
    url: z.string().url(),
    apiBaseUrl: z.string().url(),
    defaultAuth: z.object({
      type: z.enum(['basic', 'bearer', 'apiKey', 'oauth2']),
      token: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      apiKey: z.string().optional(),
      apiKeyName: z.string().optional(),
      apiKeyIn: z.enum(['header', 'query']).optional(),
    }).optional(),
  }),
  log: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
  }),
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

const defaultConfig: Config = {
  swagger: {
    url: 'https://petstore.swagger.io/v2/swagger.json',
    apiBaseUrl: 'https://petstore.swagger.io/v2',
    defaultAuth: {
      type: 'apiKey',
      apiKey: 'special-key',
      apiKeyName: 'api_key',
      apiKeyIn: 'header',
    },
  },
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