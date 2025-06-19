const { SimpleMessageBus } = require('./simple-message-bus');
const EventEmitter = require('events');

class InterAgentServer extends EventEmitter {
  constructor(redisUrl = 'redis://localhost:6380', redisPassword) {
    super();
    this.messageBus = new SimpleMessageBus(redisUrl, redisPassword);
    this.agentRegistry = new Map();
    this.messageHandlers = new Map();
    this.heartbeatIntervals = new Map();
    this.monitoringEnabled = true;
  }

  async start() {
    await this.messageBus.connect();
    console.log('✅ Inter-Agent Server started with monitoring');
  }

  async registerAgent(info) {
    // Ensure message bus is connected
    if (!this.messageBus.subscriber) {
      await this.messageBus.connect();
    }
    
    const agentInfo = {
      ...info,
      lastHeartbeat: new Date().toISOString()
    };
    
    this.agentRegistry.set(info.id, agentInfo);
    
    // Subscribe to agent's messages
    await this.messageBus.subscribe(info.id, (message) => {
      this.handleAgentMessage(info.id, message);
    });
    
    // Start heartbeat monitoring
    this.startHeartbeatMonitor(info.id);
    
    // Publish to monitoring
    if (this.monitoringEnabled) {
      await this.messageBus.publisher.publish('agent:registered', JSON.stringify({
        id: info.id,
        name: info.metadata?.name || info.id,
        role: info.role,
        status: info.status,
        capabilities: info.capabilities,
        metadata: info.metadata
      }));
    }
    
    // Broadcast to agents
    await this.messageBus.sendMessage(
      'system',
      'all',
      'broadcast',
      {
        event: 'agent_registered',
        agent: agentInfo
      }
    );
    
    console.log(`Agent registered: ${info.id} (${info.role})`);
  }

  async unregisterAgent(agentId) {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) return;
    
    // Stop heartbeat monitoring
    const interval = this.heartbeatIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(agentId);
    }
    
    // Remove from registry
    this.agentRegistry.delete(agentId);
    
    // Publish to monitoring
    if (this.monitoringEnabled) {
      await this.messageBus.publisher.publish('agent:status:update', JSON.stringify({
        agentId,
        status: 'offline'
      }));
    }
    
    console.log(`Agent unregistered: ${agentId}`);
  }

  async updateAgentStatus(agentId, status, currentTask) {
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.status = status;
      agent.currentTask = currentTask;
      agent.lastHeartbeat = new Date().toISOString();
      
      // Publish to monitoring
      if (this.monitoringEnabled) {
        await this.messageBus.publisher.publish('agent:status:update', JSON.stringify({
          agentId,
          status,
          currentTask,
          timestamp: Date.now()
        }));
      }
    }
  }

  async sendHeartbeat(agentId) {
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date().toISOString();
      
      // Publish to monitoring
      if (this.monitoringEnabled) {
        await this.messageBus.publisher.publish(`agent:heartbeat:${agentId}`, JSON.stringify({
          health: { healthy: true },
          timestamp: Date.now()
        }));
      }
    }
  }

  async sendToAgent(from, to, payload, options = {}) {
    const messageId = await this.messageBus.sendMessage(from, to, 'message', payload, options);
    
    // Publish to monitoring
    if (this.monitoringEnabled) {
      await this.messageBus.publisher.publish('agent:message', JSON.stringify({
        id: messageId,
        from,
        to,
        type: payload.type || 'message',
        timestamp: Date.now()
      }));
    }
    
    return messageId;
  }

  registerMessageHandler(agentId, handler) {
    this.messageHandlers.set(agentId, handler);
  }

  async handleAgentMessage(agentId, message) {
    const handler = this.messageHandlers.get(agentId);
    if (handler) {
      try {
        const response = await handler(message);
        if (message.requiresResponse && message.correlationId) {
          await this.messageBus.sendMessage(
            agentId,
            message.from,
            'response',
            response,
            { correlationId: message.correlationId }
          );
        }
      } catch (error) {
        console.error(`Error handling message for ${agentId}:`, error);
      }
    }
  }

  startHeartbeatMonitor(agentId) {
    const interval = setInterval(() => {
      const agent = this.agentRegistry.get(agentId);
      if (agent) {
        const lastSeen = new Date(agent.lastHeartbeat).getTime();
        const now = Date.now();
        
        if (now - lastSeen > 30000) { // 30 seconds
          this.updateAgentStatus(agentId, 'offline');
        }
      }
    }, 10000); // Check every 10 seconds
    
    this.heartbeatIntervals.set(agentId, interval);
  }

  async requestResponse(from, to, payload, timeout = 5000) {
    const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
      
      // Subscribe to response
      const responseHandler = (message) => {
        if (message.correlationId === correlationId) {
          clearTimeout(timer);
          resolve(message.payload);
        }
      };
      
      this.messageBus.subscribe(`${from}:responses`, responseHandler);
      
      // Send request
      this.sendToAgent(from, to, payload, {
        correlationId,
        requiresResponse: true
      });
    });
  }

  async broadcastToRole(from, role, payload) {
    const agents = Array.from(this.agentRegistry.values())
      .filter(agent => agent.role === role && agent.status !== 'offline');
    
    const messageIds = [];
    for (const agent of agents) {
      const id = await this.sendToAgent(from, agent.id, payload);
      messageIds.push(id);
    }
    
    return messageIds;
  }

  getSystemStatus() {
    const agents = Array.from(this.agentRegistry.values());
    
    return {
      totalAgents: agents.length,
      onlineAgents: agents.filter(a => a.status !== 'offline').length,
      agents: agents.map(a => ({
        id: a.id,
        role: a.role,
        status: a.status,
        lastSeen: a.lastHeartbeat
      }))
    };
  }

  async stop() {
    // Clear all heartbeat intervals
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }
    
    await this.messageBus.disconnect();
    console.log('✅ Inter-Agent Server stopped');
  }
}

module.exports = { InterAgentServer };