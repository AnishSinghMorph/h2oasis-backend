import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'H2Oasis API Documentation',
      version: '1.0.0',
      description: 'API documentation for H2Oasis backend - Health & Wellness platform with wearable integration',
      contact: {
        name: 'H2Oasis Team',
        email: 'support@h2oasis.com',
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Health Data', description: 'Unified health data from wearables' },
      { name: 'Products', description: 'H2Oasis products (Cold Plunge, Hot Tub, Sauna)' },
      { name: 'Chat', description: 'AI chat with ElevenLabs integration' },
      { name: 'Text-to-Speech', description: 'Text-to-Speech endpoints' },
      { name: 'Speech-to-Text', description: 'Speech-to-Text endpoints' },
      { name: 'ElevenLabs', description: 'ElevenLabs voice agent integration' },
      { name: 'Health', description: 'System health checks' },
    ],
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.h2oasis.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        FirebaseAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-firebase-uid',
          description: 'Firebase UID for user authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
          },
        },
        HealthData: {
          type: 'object',
          properties: {
            sleep: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date-time' },
                durationHours: { type: 'number' },
                efficiency: { type: 'number' },
                qualityScore: { type: 'number' },
                heartRate: {
                  type: 'object',
                  properties: {
                    max: { type: 'number' },
                    min: { type: 'number' },
                    avg: { type: 'number' },
                  },
                },
              },
            },
            activity: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date-time' },
                steps: { type: 'number' },
                calories: { type: 'number' },
                activityScore: { type: 'number' },
              },
            },
            body: {
              type: 'object',
              properties: {
                weight_kg: { type: 'number' },
                height_cm: { type: 'number' },
                bmi: { type: 'number' },
              },
            },
            lastFetched: { type: 'string', format: 'date-time' },
          },
        },
        Wearable: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'oura' },
            name: { type: 'string', example: 'Oura Ring' },
            type: { type: 'string', enum: ['sdk', 'api'], example: 'api' },
            connected: { type: 'boolean', example: true },
            lastSync: { type: 'string', format: 'date-time' },
            data: { $ref: '#/components/schemas/HealthData' },
          },
        },
      },
    },
    security: [
      {
        FirebaseAuth: [],
      },
    ],
  },
  apis: [
    path.join(__dirname, '../routes/**/*.ts'),
    path.join(__dirname, '../routes/**/*.js'),
    path.join(__dirname, '../../src/routes/**/*.ts'),
  ], // Scan route files for JSDoc comments (both TS source and compiled JS)
};

export const swaggerSpec = swaggerJsdoc(options);
