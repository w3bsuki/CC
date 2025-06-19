import Redis from 'ioredis';
import { EventEmitter } from 'eventemitter3';

export interface Message {
  id: string;
  from: string;
  to: string;
  type: 'direct' | 'broadcast' | 'request' | 'response' | 'event';
  timestamp: string;
  payload: any;
  correlationId?: string;
  replyTo?: string;
}

export class SimpleMessageBus {
  private publisher: Redis;
  private subscriber: Redis;
  private emitter: EventEmitter;
  private messageHistory: Map<string, Message[]>;
  
  constructor(redisUrl: string = 'redis://localhost:6380', password?: string) {
    const redisConfig = {
      password,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    };

    this.publisher = new Redis(redisUrl, redisConfig);
    this.subscriber = new Redis(redisUrl, redisConfig);
    this.emitter = new EventEmitter();
    this.messageHistory = new Map();
    
    this.setupRedisHandlers();
  }

  private setupRedisHandlers() {
    // Subscribe to all agent channels
    this.subscriber.psubscribe('agent:*', (err) => {
      if (err) console.error('Failed to subscribe:', err);
    });

    // Handle incoming messages
    this.subscriber.on('pmessage', (pattern, channel, data) => {
      try {
        const message = JSON.parse(data) as Message;
        this.handleMessage(channel, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    // Connection handlers
    this.publisher.on('connect', () => {
      console.log('Publisher connected to Redis');
    });

    this.subscriber.on('connect', () => {
      console.log('Subscriber connected to Redis');
    });
  }

  async sendMessage(from: string, to: string, type: Message['type'], payload: any, options?: {
    correlationId?: string;
    replyTo?: string;
  }): Promise<string> {
    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      type,
      timestamp: new Date().toISOString(),
      payload,
      correlationId: options?.correlationId,
      replyTo: options?.replyTo
    };
    
    const channel = type === 'broadcast' ? 'agent:broadcast' : `agent:${to}`;
    await this.publisher.publish(channel, JSON.stringify(message));
    
    // Store in history
    this.addToHistory(to, message);
    if (from !== to) {
      this.addToHistory(from, message);
    }
    
    return message.id;
  }

  subscribe(agentId: string, callback: (message: Message) => void): void {
    // Subscribe to agent-specific channel
    this.subscriber.subscribe(`agent:${agentId}`);
    
    // Subscribe to broadcast channel
    this.subscriber.subscribe('agent:broadcast');
    
    // Register callback
    this.emitter.on(`message:${agentId}`, callback);
  }

  private handleMessage(channel: string, message: Message) {
    // Extract agent ID from channel
    const parts = channel.split(':');
    if (parts.length === 2) {
      const targetAgent = parts[1];
      
      if (targetAgent === 'broadcast') {
        // Emit to all listeners
        this.emitter.eventNames().forEach(event => {
          if (event.toString().startsWith('message:')) {
            this.emitter.emit(event, message);
          }
        });
      } else {
        // Emit to specific agent
        this.emitter.emit(`message:${targetAgent}`, message);
      }
    }
  }

  private addToHistory(agentId: string, message: Message) {
    if (!this.messageHistory.has(agentId)) {
      this.messageHistory.set(agentId, []);
    }
    
    const history = this.messageHistory.get(agentId)!;
    history.push(message);
    
    // Keep only last 1000 messages
    if (history.length > 1000) {
      history.shift();
    }
  }

  getMessages(agentId: string, since?: string): Message[] {
    const history = this.messageHistory.get(agentId) || [];
    
    if (!since) {
      return history.slice(-50);
    }
    
    const sinceTime = new Date(since).getTime();
    return history.filter(msg => new Date(msg.timestamp).getTime() > sinceTime);
  }

  async healthCheck() {
    return {
      status: this.publisher.status === 'ready' && this.subscriber.status === 'ready' ? 'healthy' : 'unhealthy',
      publisher: this.publisher.status,
      subscriber: this.subscriber.status,
      messageHistorySize: this.messageHistory.size,
      timestamp: new Date().toISOString()
    };
  }

  async stop() {
    this.emitter.removeAllListeners();
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}