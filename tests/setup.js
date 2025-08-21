const mongoose = require('mongoose');

// Increase timeout for tests
jest.setTimeout(30000);

// Mock logger to avoid console spam during tests
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.STUB_MODE = 'true';
