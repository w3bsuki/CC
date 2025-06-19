#!/usr/bin/env node

const { InterAgentServer } = require('./inter-agent-server-monitored');

async function startServer() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';
  const redisPassword = process.env.REDIS_PASSWORD;
  
  console.log('🚀 Starting Inter-Agent Server...');
  console.log(`   Redis URL: ${redisUrl}`);
  
  const server = new InterAgentServer(redisUrl, redisPassword);
  
  try {
    await server.start();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n⏹️  Shutting down Inter-Agent Server...');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n⏹️  Shutting down Inter-Agent Server...');
      await server.stop();
      process.exit(0);
    });
    
    // Keep process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Failed to start Inter-Agent Server:', error);
    process.exit(1);
  }
}

startServer();