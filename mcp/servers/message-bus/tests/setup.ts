// Test setup
jest.setTimeout(10000); // 10 seconds for async operations

// Mock console.error to reduce noise in tests
global.console.error = jest.fn();

// Clean up after tests
afterAll(async () => {
  // Allow time for connections to close
  await new Promise(resolve => setTimeout(resolve, 1000));
});