import { SimpleMessageBus } from '../src/simple-message-bus';

async function test() {
  console.log('Testing Message Bus...');
  
  const bus = new SimpleMessageBus('redis://localhost:6379', 'mcp-redis-secret-2025');
  
  // Subscribe to messages for agent2
  bus.subscribe('agent2', (message) => {
    console.log('Agent2 received:', message);
  });
  
  // Wait for subscription
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Send a test message
  const messageId = await bus.sendMessage(
    'agent1',
    'agent2', 
    'direct',
    { content: 'Hello Agent 2!' }
  );
  
  console.log('Sent message:', messageId);
  
  // Wait for message delivery
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check message history
  const messages = bus.getMessages('agent2');
  console.log('Message history:', messages);
  
  // Health check
  const health = await bus.healthCheck();
  console.log('Health:', health);
  
  // Clean up
  await bus.stop();
  console.log('Test complete!');
}

test().catch(console.error);