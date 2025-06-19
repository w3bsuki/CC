import Redis from 'ioredis';
import { EventEmitter } from 'eventemitter3';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Message schemas
const MessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  type: z.enum(['direct', 'broadcast', 'request', 'response', 'event']),
  timestamp: z.string(),
  payload: z.any(),
  correlationId: z.string().optional(),
  replyTo: z.string().optional()
});

const SubscriptionSchema = z.object({
  agentId: z.string(),
  topics: z.array(z.string()),
  patterns: z.array(z.string()).optional()
});

type Message = z.infer<typeof MessageSchema>;
type Subscription = z.infer<typeof SubscriptionSchema>;

export class MessageBusServer {
  private publisher: Redis;
  private subscriber: Redis;
  private emitter: EventEmitter;
  private subscriptions: Map<string, Set<string>>;
  private messageHistory: Map<string, Message[]>;
  private mcpServer: Server;
  
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
    this.subscriptions = new Map();
    this.messageHistory = new Map();
    
    // Initialize MCP server
    this.mcpServer = new Server({
      name: 'message-bus',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupMcpTools();
    this.setupRedisHandlers();
  }

  private setupMcpTools() {
    // Send message tool
    this.mcpServer.setRequestHandler('tools/call', async (request) => {
        if (request.params.name === 'send_message') {
          const args = SendMessageArgsSchema.parse(request.params.arguments);
          const message: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            from: args.from,
            to: args.to,
            type: args.type || 'direct',
            timestamp: new Date().toISOString(),
            payload: args.payload,
            correlationId: args.correlationId,
            replyTo: args.replyTo
          };
          
          await this.publishMessage(message);
          
          return {
            content: [{
              type: 'text',
              text: `Message sent with ID: ${message.id}`
            }]
          };
        }
        
        if (request.params.name === 'subscribe') {
          const args = SubscribeArgsSchema.parse(request.params.arguments);
          await this.subscribe(args.agentId, args.topics);
          
          return {
            content: [{
              type: 'text',
              text: `Subscribed ${args.agentId} to topics: ${args.topics.join(', ')}`
            }]
          };
        }

        if (request.params.name === 'get_messages') {
          const args = GetMessagesArgsSchema.parse(request.params.arguments);
          const messages = await this.getMessages(args.agentId, args.since);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(messages, null, 2)
            }]
          };
        }

        if (request.params.name === 'health_check') {
          const health = await this.healthCheck();
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(health, null, 2)
            }]
          };
        }

        throw new Error(`Unknown tool: ${request.params.name}`);
    });

    // List available tools
    this.mcpServer.setRequestHandler('tools/list', async () => ({
        tools: [
          {
            name: 'send_message',
            description: 'Send a message through the message bus',
            inputSchema: SendMessageArgsSchema
          },
          {
            name: 'subscribe',
            description: 'Subscribe an agent to topics',
            inputSchema: SubscribeArgsSchema
          },
          {
            name: 'get_messages',
            description: 'Get messages for an agent',
            inputSchema: GetMessagesArgsSchema
          },
          {
            name: 'health_check',
            description: 'Check message bus health',
            inputSchema: {}
          }
        ]
    }));
  }

  private setupRedisHandlers() {
    // Subscribe to all channels
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

    // Connection event handlers
    this.publisher.on('connect', () => {
      console.log('Publisher connected to Redis');
    });

    this.subscriber.on('connect', () => {
      console.log('Subscriber connected to Redis');
    });

    this.publisher.on('error', (err) => {
      console.error('Publisher Redis error:', err);
    });

    this.subscriber.on('error', (err) => {
      console.error('Subscriber Redis error:', err);
    });
  }

  private async publishMessage(message: Message) {
    const channel = message.type === 'broadcast' 
      ? 'agent:broadcast' 
      : `agent:${message.to}`;
    
    await this.publisher.publish(channel, JSON.stringify(message));
    
    // Store in history
    this.addToHistory(message.to, message);
    if (message.from !== message.to) {
      this.addToHistory(message.from, message);
    }
  }

  private handleMessage(channel: string, message: Message) {
    // Emit locally for any listeners
    this.emitter.emit('message', message);
    
    // Store in appropriate histories
    if (message.type === 'broadcast') {
      // Store broadcast messages for all subscribed agents
      for (const [agentId, topics] of this.subscriptions) {
        if (topics.has('broadcast')) {
          this.addToHistory(agentId, message);
        }
      }
    }
  }

  private addToHistory(agentId: string, message: Message) {
    if (!this.messageHistory.has(agentId)) {
      this.messageHistory.set(agentId, []);
    }
    
    const history = this.messageHistory.get(agentId)!;
    history.push(message);
    
    // Keep only last 1000 messages per agent
    if (history.length > 1000) {
      history.shift();
    }
  }

  private async subscribe(agentId: string, topics: string[]) {
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, new Set());
    }
    
    const agentTopics = this.subscriptions.get(agentId)!;
    topics.forEach(topic => agentTopics.add(topic));
    
    // Subscribe to agent-specific channel
    await this.subscriber.subscribe(`agent:${agentId}`);
    
    // Subscribe to broadcast if requested
    if (topics.includes('broadcast')) {
      await this.subscriber.subscribe('agent:broadcast');
    }
  }

  private async getMessages(agentId: string, since?: string): Promise<Message[]> {
    const history = this.messageHistory.get(agentId) || [];
    
    if (!since) {
      return history.slice(-50); // Return last 50 messages
    }
    
    const sinceTime = new Date(since).getTime();
    return history.filter(msg => 
      new Date(msg.timestamp).getTime() > sinceTime
    );
  }

  private async healthCheck() {
    const publisherStatus = this.publisher.status;
    const subscriberStatus = this.subscriber.status;
    
    return {
      status: publisherStatus === 'ready' && subscriberStatus === 'ready' ? 'healthy' : 'unhealthy',
      publisher: publisherStatus,
      subscriber: subscriberStatus,
      subscriptions: this.subscriptions.size,
      messageHistorySize: this.messageHistory.size,
      timestamp: new Date().toISOString()
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    console.error('Message Bus MCP Server started');
  }

  async stop() {
    await this.publisher.quit();
    await this.subscriber.quit();
    console.log('Message Bus stopped');
  }
}

// Argument schemas for MCP tools
const SendMessageArgsSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(['direct', 'broadcast', 'request', 'response', 'event']).optional(),
  payload: z.any(),
  correlationId: z.string().optional(),
  replyTo: z.string().optional()
});

const SubscribeArgsSchema = z.object({
  agentId: z.string(),
  topics: z.array(z.string())
});

const GetMessagesArgsSchema = z.object({
  agentId: z.string(),
  since: z.string().optional()
});

// Main entry point
if (require.main === module) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';
  const redisPassword = process.env.REDIS_PASSWORD || 'mcp-redis-secret-2025';
  
  const server = new MessageBusServer(redisUrl, redisPassword);
  server.start().catch(console.error);
  
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });
}