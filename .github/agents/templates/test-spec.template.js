import { test, expect } from '@playwright/test';
import SchemaValidator from '@api/utils/schema-validator.js';
import ServiceClient from '@api/services/<service-name>/<client-file>.api.js';
import { successSchema, errorSchema } from './<resource>.schema.js';

test.describe('<Service> - <Resource> API Tests', () => {
  test(
    'Should successfully <action> when <condition>',
    { tag: ['@<TEST-ID>', '@smoke'] },
    async () => {
      // Arrange
      const request = {
        // Request payload
      };

      // Act
      const response = await ServiceClient.methodName(request);

      // Assert
      expect(response.status).toBe(200);
      expect(response.data.code).toBe(0);
      SchemaValidator.validate(successSchema, response.data);

      // Additional assertions
      expect(response.data.data).toHaveProperty('expectedField');
    },
  );

  test(
    'Should return error when <invalid condition>',
    { tag: ['@<TEST-ID>'] },
    async () => {
      // Arrange
      const request = {
        // Invalid payload
      };

      // Act
      const response = await ServiceClient.methodName(request);

      // Assert
      expect(response.status).toBe(400);
      expect(response.data.code).toBeGreaterThan(0);
      SchemaValidator.validate(errorSchema, response.data);
    },
  );
});
