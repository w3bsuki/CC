import { InterAgentServer } from '../inter-agent-server';
import { PRDAgentService } from './PRDAgentService';
import { AgentBaseService, AgentServiceOptions } from '../../../../services/agent-base';
import * as path from 'path';

/**
 * Mock Task Agent for demonstration
 */
class MockTaskAgentService extends AgentBaseService {
  protected async initialize(): Promise<void> {
    console.log('Mock Task Agent initialized');
  }
  
  protected async cleanup(): Promise<void> {
    console.log('Mock Task Agent cleaned up');
  }
  
  protected async processMessage(message: any): Promise<any> {
    console.log('Task Agent received message:', message);
    
    if (message.type === 'requirements-complete') {
      console.log('Processing requirements from PRD agent:', message.payload);
      return {
        success: true,
        message: 'Requirements received and tasks will be generated'
      };
    }
    
    return { error: 'Unknown message type' };
  }
  
  protected async checkHealth(): Promise<any> {
    return { healthy: true };
  }
}

/**
 * Example integration showing PRD and Task agents working together
 */
async function runIntegrationExample() {
  console.log('🚀 Starting Inter-Agent Integration Example\n');
  
  // Initialize the inter-agent server
  const interAgentServer = new InterAgentServer('redis://localhost:6379');
  
  const workspacePath = '/home/w3bsuki/omg/claude-multi-agent';
  
  // Create PRD Agent
  const prdAgent = new PRDAgentService({
    interAgentServer,
    config: {
      id: 'prd-agent-001',
      role: 'prd' as const,
      name: 'PRD Parser Agent',
      description: 'Parses PRD documents and extracts requirements',
      capabilities: ['parse-markdown', 'extract-requirements'],
      workspacePath
    }
  });
  
  // Create Mock Task Agent
  const taskAgent = new MockTaskAgentService({
    interAgentServer,
    config: {
      id: 'task-agent-001',
      role: 'task' as const,
      name: 'Task Generator Agent',
      description: 'Generates tasks from requirements',
      capabilities: ['generate-tasks', 'prioritize-tasks'],
      workspacePath
    }
  });
  
  // Start both agents
  await prdAgent.start();
  await taskAgent.start();
  
  console.log('\n✅ Both agents started successfully\n');
  
  // Simulate processing a PRD
  console.log('📄 Sending PRD processing request...\n');
  
  // This would trigger the PRD agent to:
  // 1. Parse the PRD
  // 2. Extract requirements
  // 3. Generate initial tasks
  // 4. Notify the task agent
  
  const messageId = await interAgentServer.sendToAgent(
    'orchestrator',
    'prd-agent-001',
    {
      type: 'process-prd',
      payload: {
        prdPath: 'shared/requirements/prd.md'
      }
    }
  );
  
  console.log(`Message sent with ID: ${messageId}\n`);
  
  // Wait a bit for processing
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check system status
  const status = interAgentServer.getSystemStatus();
  console.log('\n📊 System Status:', JSON.stringify(status, null, 2));
  
  // Shutdown handlers
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down agents...');
    await prdAgent.stop();
    await taskAgent.stop();
    await interAgentServer.stop();
    process.exit(0);
  });
  
  console.log('\n✨ Integration example running. Press Ctrl+C to stop.\n');
}

// Run the example if executed directly
if (require.main === module) {
  runIntegrationExample().catch(error => {
    console.error('Integration example error:', error);
    process.exit(1);
  });
}

export { runIntegrationExample };