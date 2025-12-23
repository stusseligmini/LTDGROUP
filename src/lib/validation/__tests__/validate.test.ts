/**
 * Validation Utilities Tests
 * 
 * Tests validation helper functions
 */

import { describe, expect, it, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
  validationErrorResponse,
  successResponse,
} from '../validate';

describe('validateBody', () => {
  const TestSchema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
  });
  
  it('should validate valid body', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'John', age: 30 }),
    });
    
    const result = await validateBody(request, TestSchema);
    
    expect(result.name).toBe('John');
    expect(result.age).toBe(30);
  });
  
  it('should throw ValidationError for invalid body', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: '', age: -5 }),
    });
    
    await expect(validateBody(request, TestSchema)).rejects.toThrow();
  });
  
  it('should handle missing fields', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'John' }),
    });
    
    await expect(validateBody(request, TestSchema)).rejects.toThrow();
  });
});

describe('validateQuery', () => {
  const QuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  });
  
  it('should validate valid query params', () => {
    const request = new NextRequest('http://localhost/api/test?limit=10&offset=5');
    const result = validateQuery(request, QuerySchema);
    
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
  });
  
  it('should use default values', () => {
    const request = new NextRequest('http://localhost/api/test');
    const result = validateQuery(request, QuerySchema);
    
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });
  
  it('should throw ValidationError for invalid values', () => {
    const request = new NextRequest('http://localhost/api/test?limit=200&offset=-1');
    
    expect(() => validateQuery(request, QuerySchema)).toThrow();
  });
});

describe('validateParams', () => {
  const ParamSchema = z.object({
    id: z.string().uuid(),
  });
  
  it('should validate valid params', () => {
    const params = { id: '123e4567-e89b-12d3-a456-426614174000' };
    const result = validateParams(params, ParamSchema);
    
    expect(result.id).toBe('123e4567-e89b-12d3-a456-426614174000');
  });
  
  it('should throw ValidationError for invalid UUID', () => {
    const params = { id: 'not-a-uuid' };
    
    expect(() => validateParams(params, ParamSchema)).toThrow();
  });
});

describe('validationErrorResponse', () => {
  it('should format validation error correctly', async () => {
    const { ValidationError } = await import('../validate');
    const error = new ValidationError([
      { field: 'name', message: 'Expected string, received number' },
    ]);
    
    const response = validationErrorResponse(error);
    
    expect(response.status).toBe(400);
  });
  
  it('should include multiple validation errors', async () => {
    const { ValidationError } = await import('../validate');
    const error = new ValidationError([
      { field: 'name', message: 'Expected string' },
      { field: 'age', message: 'Must be positive' },
    ]);
    
    const response = validationErrorResponse(error);
    expect(response.status).toBe(400);
  });
});

describe('successResponse', () => {
  it('should create success response with data', () => {
    const data = { id: '123', name: 'Test' };
    const response = successResponse(data);
    
    expect(response.status).toBe(200);
  });
  
  it('should support custom status code', () => {
    const data = { id: '123' };
    const response = successResponse(data, 201);
    
    expect(response.status).toBe(201);
  });
  
  it('should handle null data', () => {
    const response = successResponse(null);
    
    expect(response.status).toBe(200);
  });
});

describe('Integration: Full validation flow', () => {
  const UserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    age: z.number().int().min(18).optional(),
  });
  
  it('should validate complete user object', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'SecurePass123!',
        age: 25,
      }),
    });
    
    const result = await validateBody(request, UserSchema);
    
    expect(result.email).toBe('user@example.com');
    expect(result.password).toBe('SecurePass123!');
    expect(result.age).toBe(25);
  });
  
  it('should catch all validation errors', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
        password: '123',
        age: 15,
      }),
    });
    
    await expect(validateBody(request, UserSchema)).rejects.toThrow();
  });
});
