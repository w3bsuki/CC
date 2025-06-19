import { SimpleMessageBus, Message } from './simple-message-bus';
import { EventEmitter } from 'eventemitter3';

export interface AgentInfo {
  id: string;
  role: 'prd' | 'task' | 'architect' | 'builder' | 'qa' | 'orchestrator';
  status: 'idle' | 'working' | 'blocked' | 'offline';
  capabilities: string[];
  lastHeartbeat: string;
  currentTask?: string;
  metadata?: Record<string, any>;
}

export interface AgentMessage extends Message {
  priority?: 'low' | 'normal' | 'high' | 'critical';
  requiresResponse?: boolean;
  timeout?: number;
}

export class InterAgentServer {
  private messageBus: SimpleMessageBus;
  private agentRegistry: Map<string, AgentInfo>;
  private messageHandlers: Map<string, (message: AgentMessage) => Promise<any>>;
  private emitter: EventEmitter;
  private heartbeatIntervals: Map<string, NodeJS.Timeout>;
  
  constructor(redisUrl: string = 'redis://localhost:6380', redisPassword?: string) {
    this.messageBus = new SimpleMessageBus(redisUrl, redisPassword);
    this.agentRegistry = new Map();
    this.messageHandlers = new Map();
    this.emitter = new EventEmitter();
    this.heartbeatIntervals = new Map();
  }

  // Agent Registry Methods
  async registerAgent(info: Omit<AgentInfo, 'lastHeartbeat'>): Promise<void> {
    const agentInfo: AgentInfo = {
      ...info,
      lastHeartbeat: new Date().toISOString()
    };
    
    this.agentRegistry.set(info.id, agentInfo);
    
    // Subscribe to agent's messages
    this.messageBus.subscribe(info.id, (message) => {
      this.handleAgentMessage(info.id, message as AgentMessage);
    });
    
    // Start heartbeat monitoring
    this.startHeartbeatMonitor(info.id);
    
    // Broadcast agent registration
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

  async unregisterAgent(agentId: string): Promise<void> {
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
    
    // Broadcast agent unregistration
    await this.messageBus.sendMessage(
      'system',
      'all',
      'broadcast',
      {
        event: 'agent_unregistered',
        agentId
      }
    );
    
    console.log(`Agent unregistered: ${agentId}`);
  }

  updateAgentStatus(agentId: string, status: AgentInfo['status'], currentTask?: string): void {
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.status = status;
      agent.currentTask = currentTask;
      agent.lastHeartbeat = new Date().toISOString();
    }
  }

  getAgent(agentId: string): AgentInfo | undefined {
    return this.agentRegistry.get(agentId);
  }

  getAgentsByRole(role: AgentInfo['role']): AgentInfo[] {
    return Array.from(this.agentRegistry.values()).filter(agent => agent.role === role);
  }

  getAvailableAgents(): AgentInfo[] {
    return Array.from(this.agentRegistry.values()).filter(
      agent => agent.status === 'idle' && this.isAgentAlive(agent.id)
    );
  }

  // Message Routing Methods
  async sendToAgent(
    from: string,
    to: string,
    payload: any,
    options?: {
      priority?: AgentMessage['priority'];
      requiresResponse?: boolean;
      timeout?: number;
      correlationId?: string;
    }
  ): Promise<string> {
    const toAgent = this.agentRegistry.get(to);
    if (!toAgent || !this.isAgentAlive(to)) {
      throw new Error(`Agent ${to} is not available`);
    }
    
    return this.messageBus.sendMessage(from, to, 'direct', payload, {
      correlationId: options?.correlationId
    });
  }

  async broadcastToRole(
    from: string,
    role: AgentInfo['role'],
    payload: any,
    options?: {
      priority?: AgentMessage['priority'];
    }
  ): Promise<string[]> {
    const agents = this.getAgentsByRole(role);
    const messageIds: string[] = [];
    
    for (const agent of agents) {
      if (this.isAgentAlive(agent.id)) {
        const id = await this.sendToAgent(from, agent.id, payload, options);
        messageIds.push(id);
      }
    }
    
    return messageIds;
  }

  async requestResponse(
    from: string,
    to: string,
    payload: any,
    timeout: number = 30000
  ): Promise<any> {
    const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        this.emitter.off(`response:${correlationId}`);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
      
      this.emitter.once(`response:${correlationId}`, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
      
      await this.sendToAgent(from, to, payload, {
        requiresResponse: true,
        correlationId,
        timeout
      });
    });
  }

  // Message Handling
  private async handleAgentMessage(agentId: string, message: AgentMessage) {
    // Update agent heartbeat
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date().toISOString();
    }
    
    // Handle system messages
    if (message.type === 'event' && message.payload.event === 'heartbeat') {
      return; // Heartbeat handled above
    }
    
    // Handle response messages
    if (message.type === 'response' && message.correlationId) {
      this.emitter.emit(`response:${message.correlationId}`, message.payload);
      return;
    }
    
    // Route to message handlers
    const handler = this.messageHandlers.get(message.to);
    if (handler) {
      try {
        const response = await handler(message);
        
        if (message.replyTo && response !== undefined) {
          await this.messageBus.sendMessage(
            message.to,
            message.from,
            'response',
            response,
            { correlationId: message.correlationId }
          );
        }
      } catch (error) {
        console.error(`Error handling message for ${message.to}:`, error);
      }
    }
  }

  registerMessageHandler(agentId: string, handler: (message: AgentMessage) => Promise<any>): void {
    this.messageHandlers.set(agentId, handler);
  }

  // Health & Monitoring
  private startHeartbeatMonitor(agentId: string) {
    const interval = setInterval(async () => {
      const agent = this.agentRegistry.get(agentId);
      if (!agent) {
        clearInterval(interval);
        return;
      }
      
      const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
      const now = Date.now();
      
      // If no heartbeat for 60 seconds, mark as offline
      if (now - lastHeartbeat > 60000) {
        agent.status = 'offline';
        await this.messageBus.sendMessage(
          'system',
          'all',
          'broadcast',
          {
            event: 'agent_offline',
            agentId
          }
        );
      }
    }, 30000); // Check every 30 seconds
    
    this.heartbeatIntervals.set(agentId, interval);
  }

  private isAgentAlive(agentId: string): boolean {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) return false;
    
    const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
    const now = Date.now();
    
    return now - lastHeartbeat < 60000; // Alive if heartbeat within last minute
  }

  async sendHeartbeat(agentId: string): Promise<void> {
    await this.messageBus.sendMessage(
      agentId,
      agentId,
      'event',
      { event: 'heartbeat', timestamp: new Date().toISOString() }
    );
  }

  // Persistence Methods
  async saveMessageHistory(agentId: string, filepath: string): Promise<void> {
    const messages = this.messageBus.getMessages(agentId);
    const fs = await import('fs/promises');
    await fs.writeFile(filepath, JSON.stringify(messages, null, 2));
  }

  async loadMessageHistory(agentId: string, filepath: string): Promise<void> {
    const fs = await import('fs/promises');
    const data = await fs.readFile(filepath, 'utf-8');
    const messages = JSON.parse(data) as Message[];
    
    // Re-add messages to history
    for (const message of messages) {
      await this.messageBus.sendMessage(
        message.from,
        message.to,
        message.type,
        message.payload,
        {
          correlationId: message.correlationId,
          replyTo: message.replyTo
        }
      );
    }
  }

  // Utility Methods
  getSystemStatus() {
    const agents = Array.from(this.agentRegistry.values());
    
    return {
      totalAgents: agents.length,
      onlineAgents: agents.filter(a => this.isAgentAlive(a.id)).length,
      agentsByRole: agents.reduce((acc, agent) => {
        acc[agent.role] = (acc[agent.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      agentsByStatus: agents.reduce((acc, agent) => {
        acc[agent.status] = (acc[agent.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      agents: agents.map(a => ({
        id: a.id,
        role: a.role,
        status: a.status,
        alive: this.isAgentAlive(a.id),
        currentTask: a.currentTask
      }))
    };
  }

  async stop(): Promise<void> {
    // Clear all heartbeat intervals
    for (const interval of this.heartbeatIntervals.values()) {
      clearInterval(interval);
    }
    this.heartbeatIntervals.clear();
    
    // Stop message bus
    await this.messageBus.stop();
  }
}