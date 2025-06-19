"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBusServer = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const eventemitter3_1 = require("eventemitter3");
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
// Message schemas
const MessageSchema = zod_1.z.object({
    id: zod_1.z.string(),
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    type: zod_1.z.enum(['direct', 'broadcast', 'request', 'response', 'event']),
    timestamp: zod_1.z.string(),
    payload: zod_1.z.any(),
    correlationId: zod_1.z.string().optional(),
    replyTo: zod_1.z.string().optional()
});
const SubscriptionSchema = zod_1.z.object({
    agentId: zod_1.z.string(),
    topics: zod_1.z.array(zod_1.z.string()),
    patterns: zod_1.z.array(zod_1.z.string()).optional()
});
class MessageBusServer {
    constructor(redisUrl = 'redis://localhost:6380', password) {
        const redisConfig = {
            password,
            retryStrategy: (times) => Math.min(times * 50, 2000),
            enableReadyCheck: true,
            maxRetriesPerRequest: 3
        };
        this.publisher = new ioredis_1.default(redisUrl, redisConfig);
        this.subscriber = new ioredis_1.default(redisUrl, redisConfig);
        this.emitter = new eventemitter3_1.EventEmitter();
        this.subscriptions = new Map();
        this.messageHistory = new Map();
        // Initialize MCP server
        this.mcpServer = new index_js_1.Server({
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
    setupMcpTools() {
        // Send message tool
        this.mcpServer.setRequestHandler('tools/call', async (request) => {
            if (request.params.name === 'send_message') {
                const args = SendMessageArgsSchema.parse(request.params.arguments);
                const message = {
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
    setupRedisHandlers() {
        // Subscribe to all channels
        this.subscriber.psubscribe('agent:*', (err) => {
            if (err)
                console.error('Failed to subscribe:', err);
        });
        // Handle incoming messages
        this.subscriber.on('pmessage', (pattern, channel, data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(channel, message);
            }
            catch (error) {
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
    async publishMessage(message) {
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
    handleMessage(channel, message) {
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
    addToHistory(agentId, message) {
        if (!this.messageHistory.has(agentId)) {
            this.messageHistory.set(agentId, []);
        }
        const history = this.messageHistory.get(agentId);
        history.push(message);
        // Keep only last 1000 messages per agent
        if (history.length > 1000) {
            history.shift();
        }
    }
    async subscribe(agentId, topics) {
        if (!this.subscriptions.has(agentId)) {
            this.subscriptions.set(agentId, new Set());
        }
        const agentTopics = this.subscriptions.get(agentId);
        topics.forEach(topic => agentTopics.add(topic));
        // Subscribe to agent-specific channel
        await this.subscriber.subscribe(`agent:${agentId}`);
        // Subscribe to broadcast if requested
        if (topics.includes('broadcast')) {
            await this.subscriber.subscribe('agent:broadcast');
        }
    }
    async getMessages(agentId, since) {
        const history = this.messageHistory.get(agentId) || [];
        if (!since) {
            return history.slice(-50); // Return last 50 messages
        }
        const sinceTime = new Date(since).getTime();
        return history.filter(msg => new Date(msg.timestamp).getTime() > sinceTime);
    }
    async healthCheck() {
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
        const transport = new stdio_js_1.StdioServerTransport();
        await this.mcpServer.connect(transport);
        console.error('Message Bus MCP Server started');
    }
    async stop() {
        await this.publisher.quit();
        await this.subscriber.quit();
        console.log('Message Bus stopped');
    }
}
exports.MessageBusServer = MessageBusServer;
// Argument schemas for MCP tools
const SendMessageArgsSchema = zod_1.z.object({
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    type: zod_1.z.enum(['direct', 'broadcast', 'request', 'response', 'event']).optional(),
    payload: zod_1.z.any(),
    correlationId: zod_1.z.string().optional(),
    replyTo: zod_1.z.string().optional()
});
const SubscribeArgsSchema = zod_1.z.object({
    agentId: zod_1.z.string(),
    topics: zod_1.z.array(zod_1.z.string())
});
const GetMessagesArgsSchema = zod_1.z.object({
    agentId: zod_1.z.string(),
    since: zod_1.z.string().optional()
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
//# sourceMappingURL=message-bus.js.map