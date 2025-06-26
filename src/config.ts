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
      name: "device_mgr_enterprise",
      title: "IoT Device Manager (Enterprise)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/devicemgr/v2/api-docs?group=device-mgr-enterpriseapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/devicemgr",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 8
    },
    {
      name: "binding_enduser",
      title: "Binding Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/binding/v2/api-docs?group=BindingServiceEnduserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/binding",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
    },
    {
      name: "deviceshadow_enterprise",
      title: "Device Shadow (Enterprise)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/deviceshadow/v2/api-docs?group=device-shadow-enterpriseapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/deviceshadow",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
    },
    {
      name: "product_enterprise",
      title: "Product Management (Enterprise)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/quecproductmgr/v2/api-docs?group=product-mgr-enterpriseapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/quecproductmgr",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
    },
    {
      name: "tsl_enterprise",
      title: "Thing Specification Language (Enterprise)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/quectsl/v2/api-docs?group=enterpriseApi",
      baseUrl: "https://iot-api.acceleronix.io/v2/quectsl",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
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

// Full production configuration with all IoT APIs
const fullConfig: Config = {
  apis: [
    {
      name: "device_mgr_enterprise",
      title: "IoT Device Manager (Enterprise)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/devicemgr/v2/api-docs?group=device-mgr-enterpriseapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/devicemgr",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 8
    },
    {
      name: "app_service_enduser",
      title: "App Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/app/v2/api-docs?group=AppServiceEndUserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/app",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
    },
    {
      name: "binding_enduser",
      title: "Binding Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/binding/v2/api-docs?group=BindingServiceEnduserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/binding",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
    },
    {
      name: "binding_enterprise",
      title: "Binding Service (Enterprise)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/binding/v2/api-docs?group=BindingServiceEnterpriseAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/binding",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
    },
    {
      name: "devicegroup_enduser",
      title: "DeviceGroup Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/devicegroup/v2/api-docs?group=DeviceGroupServiceEnduserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/devicegroup",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 5
    },
    {
      name: "deviceshadow_enterprise",
      title: "Device Shadow (Enterprise)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/deviceshadow/v2/api-docs?group=device-shadow-enterpriseapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/deviceshadow",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
    },
    {
      name: "enduser_enduser",
      title: "EndUser Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/enduser/v2/api-docs?group=EnduserServiceEnduserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/enduser",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 5
    },
    {
      name: "family_enduser",
      title: "Family Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/family/v2/api-docs?group=FamilyServiceEnduserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/family",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 5
    },
    {
      name: "i18n_enduser",
      title: "I18n Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/i18n/v2/api-docs?group=I18nServiceEndUserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/i18n",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 4
    },
    {
      name: "matter_enduser",
      title: "Matter Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/matter/v2/api-docs?group=MatterServiceEnduserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/matter",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 5
    },
    {
      name: "category_enduser",
      title: "Category Management (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/category/v2/api-docs?group=category-mgr-enduserapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/category",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 5
    },
    {
      name: "datastorage_enduser",
      title: "Data Storage Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/quecdatastorage/v2/api-docs?group=DataStorageEnduserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/quecdatastorage",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 5
    },
    {
      name: "globalbootstrap_open",
      title: "Global Bootstrap Service (Open)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/globalbootstrap/v2/api-docs?group=global-bootrap-openapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/globalbootstrap",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 3
    },
    {
      name: "tsl_enterprise",
      title: "Thing Specification Language (Enterprise)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/quectsl/v2/api-docs?group=enterpriseApi",
      baseUrl: "https://iot-api.acceleronix.io/v2/quectsl",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
    },
    {
      name: "ota_enduser",
      title: "OTA Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/quecota/v2/api-docs?group=OTAServiceEnduserAPI",
      baseUrl: "https://iot-api.acceleronix.io/v2/quecota",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 5
    },
    {
      name: "product_enterprise",
      title: "Product Management (Enterprise)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/quecproductmgr/v2/api-docs?group=product-mgr-enterpriseapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/quecproductmgr",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 6
    },
    {
      name: "cep_enduser",
      title: "Rule Engine (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/cep/v2/api-docs?group=CepServiceEnduserApi",
      baseUrl: "https://iot-api.acceleronix.io/v2/cep",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 5
    },
    {
      name: "weather_enduser",
      title: "Weather Service (EndUser)",
      swaggerUrl: "https://iot-api.acceleronix.io/v2/quecweather/v2/api-docs?group=weather-enduserapi",
      baseUrl: "https://iot-api.acceleronix.io/v2/quecweather",
      auth: { type: 'bearer', token: '' },
      enabled: true,
      maxTools: 4
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
    // If config data is provided, use it
    if (configData) {
      return ConfigSchema.parse(configData);
    }

    // Use full configuration for production
    console.log('Using full IoT API configuration');
    return fullConfig;
    
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