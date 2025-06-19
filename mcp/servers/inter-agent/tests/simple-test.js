const { InterAgentServer } = require('../dist/inter-agent-server');

// Simple mock agent
class MockAgent {
  constructor(server, id, role) {
    this.server = server;
    this.id = id;
    this.role = role;
  }
  
  async start() {
    // Register with server
    await this.server.registerAgent({
      id: this.id,
      role: this.role,
      status: 'idle',
      capabilities: ['test', 'demo']
    });
    
    // Register message handler
    this.server.registerMessageHandler(this.id, async (message) => {
      console.log(`${this.id} received:`, message.payload);
      
      // Simulate work
      this.server.updateAgentStatus(this.id, 'working', 'Processing message');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Return response if requested
      if (message.requiresResponse) {
        this.server.updateAgentStatus(this.id, 'idle');
        return { 
          success: true, 
          result: `${this.id} processed: ${JSON.stringify(message.payload)}` 
        };
      }
      
      this.server.updateAgentStatus(this.id, 'idle');
    });
    
    // Start heartbeat
    setInterval(() => {
      this.server.sendHeartbeat(this.id);
    }, 10000);
    
    console.log(`✅ ${this.id} started`);
  }
}

async function test() {
  console.log('🧪 Testing Inter-Agent Communication...\n');
  
  const server = new InterAgentServer('redis://localhost:6379', 'mcp-redis-secret-2025');
  
  // Create mock agents
  const prdAgent = new MockAgent(server, 'prd-agent-1', 'prd');
  const taskAgent = new MockAgent(server, 'task-agent-1', 'task');
  const builderAgent = new MockAgent(server, 'builder-agent-1', 'builder');
  
  // Start agents
  await prdAgent.start();
  await taskAgent.start();
  await builderAgent.start();
  
  // Wait for registration
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 1: Direct message
  console.log('\n📨 Test 1: Direct Message');
  const messageId = await server.sendToAgent(
    'orchestrator',
    'prd-agent-1',
    { command: 'parse', document: 'test.md' }
  );
  console.log(`Sent message: ${messageId}`);
  
  // Test 2: Broadcast to role
  console.log('\n📢 Test 2: Broadcast to Role');
  const broadcastIds = await server.broadcastToRole(
    'orchestrator',
    'task',
    { announcement: 'New project starting' }
  );
  console.log(`Broadcast sent to ${broadcastIds.length} agents`);
  
  // Test 3: Request-Response
  console.log('\n💬 Test 3: Request-Response');
  try {
    const response = await server.requestResponse(
      'orchestrator',
      'builder-agent-1',
      { action: 'build', target: 'component.tsx' },
      5000
    );
    console.log('Response received:', response);
  } catch (error) {
    console.error('Request failed:', error);
  }
  
  // Test 4: System status
  console.log('\n📊 Test 4: System Status');
  const status = server.getSystemStatus();
  console.log('System Status:', JSON.stringify(status, null, 2));
  
  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Clean up
  await server.stop();
  console.log('\n✅ All tests complete!');
  process.exit(0);
}

test().catch(console.error);