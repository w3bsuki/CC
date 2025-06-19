#!/usr/bin/env node

// Simple entry point for the message bus server using the compiled version
const { MessageBusServer } = require('./dist/message-bus');

const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
  redisPassword: process.env.REDIS_PASSWORD || 'mcp-redis-secret-2025',
  messageSecret: process.env.MESSAGE_SECRET || 'mcp-message-secret-2025',
  maxHistorySize: parseInt(process.env.MAX_HISTORY_SIZE || '1000'),
  circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
  circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000')
};

async function main() {
  console.error('Starting Message Bus MCP Server...');
  console.error('Configuration:', {
    ...config,
    redisPassword: '***',
    messageSecret: '***'
  });

  const server = new MessageBusServer(
    config.redisUrl,
    config.redisPassword
  );

  try {
    await server.start();
    console.error('Message Bus MCP Server started successfully');

    // Graceful shutdown handlers
    const shutdown = async () => {
      console.error('Shutting down Message Bus...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep process alive
    process.stdin.resume();
  } catch (error) {
    console.error('Failed to start Message Bus:', error);
    process.exit(1);
  }
}

main().catch(console.error);