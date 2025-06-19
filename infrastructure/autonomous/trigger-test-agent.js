#!/usr/bin/env node

const Redis = require('ioredis');

async function triggerTestAgent() {
  const redis = new Redis({
    host: 'localhost',
    port: 6380
  });

  console.log('🧪 Triggering test agent to verify terminal spawning...');

  const testEvent = {
    agent: 'architect-agent',
    trigger: 'manual-test',
    timestamp: new Date().toISOString()
  };

  try {
    await redis.publish('agent:trigger', JSON.stringify(testEvent));
    console.log('✅ Agent trigger sent successfully');
    console.log('📺 Check for new terminal window with architect agent');
    
    // Listen for completion
    const completionSub = new Redis({
      host: 'localhost',
      port: 6380
    });
    
    completionSub.subscribe('agent:completed');
    completionSub.on('message', (channel, message) => {
      if (channel === 'agent:completed') {
        const completion = JSON.parse(message);
        console.log(`🏁 Agent completed: ${completion.agent} (exit code: ${completion.exitCode})`);
        process.exit(0);
      }
    });

    console.log('⏳ Waiting for agent completion...');
    
    // Timeout after 30 seconds
    setTimeout(() => {
      console.log('⏰ Test timeout - check if terminal spawned manually');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    console.error('❌ Failed to trigger agent:', error.message);
    process.exit(1);
  }
}

triggerTestAgent().catch(console.error);