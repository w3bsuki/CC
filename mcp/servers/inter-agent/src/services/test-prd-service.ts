import { InterAgentServer } from '../inter-agent-server';
import { PRDAgentService } from './PRDAgentService';
import * as path from 'path';

/**
 * Example of how to use the PRD Agent Service
 */
async function testPRDService() {
  // Initialize the inter-agent server
  const interAgentServer = new InterAgentServer('redis://localhost:6379');
  
  // Create PRD agent configuration
  const prdAgentConfig = {
    id: 'prd-agent-001',
    role: 'prd' as const,
    name: 'PRD Parser Agent',
    description: 'Parses PRD documents and extracts requirements',
    capabilities: [
      'parse-markdown',
      'extract-requirements',
      'generate-tasks',
      'estimate-effort'
    ],
    workspacePath: '/home/w3bsuki/omg/claude-multi-agent',
    mcpServers: {}
  };
  
  // Create PRD agent service instance
  const prdAgent = new PRDAgentService({
    interAgentServer,
    config: prdAgentConfig,
    claudeMdPath: path.join(prdAgentConfig.workspacePath, 'agents/prd-agent/claude.md')
  });
  
  // Start the agent
  await prdAgent.start();
  
  console.log('PRD Agent Service started successfully!');
  
  // Example: Process a PRD manually
  // await prdAgent.processPRDStandalone('shared/requirements/prd.md');
  
  // Example: Send a message to process PRD
  // await interAgentServer.sendToAgent(
  //   'orchestrator',
  //   'prd-agent-001',
  //   {
  //     type: 'process-prd',
  //     payload: {
  //       prdPath: 'shared/requirements/prd.md'
  //     }
  //   }
  // );
  
  // Keep the service running
  process.on('SIGINT', async () => {
    console.log('\nShutting down PRD Agent Service...');
    await prdAgent.stop();
    await interAgentServer.stop();
    process.exit(0);
  });
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPRDService().catch(error => {
    console.error('Error running PRD service test:', error);
    process.exit(1);
  });
}

export { testPRDService };