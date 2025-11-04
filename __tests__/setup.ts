// Global test setup
// This runs once before all tests

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.PORT = "3001";

// Mock console methods if needed
global.console = {
  ...console,
  error: jest.fn(), // Mock console.error to avoid cluttering test output
  warn: jest.fn(),
};

// Add custom Jest matchers or global test utilities here
