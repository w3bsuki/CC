"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBusServer = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const eventemitter3_1 = require("eventemitter3");
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
// Enhanced message schemas with better validation and extensibility
const MessageMetadataSchema = zod_1.z.object({
    priority: zod_1.z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
    ttl: zod_1.z.number().optional(), // Time to live in seconds
    encrypted: zod_1.z.boolean().default(false),
    compression: zod_1.z.enum(['none', 'gzip', 'brotli']).default('none'),
    retryCount: zod_1.z.number().default(0),
    maxRetries: zod_1.z.number().default(3)
});
const MessageSchema = zod_1.z.object({
    id: zod_1.z.string(),
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    type: zod_1.z.enum(['direct', 'broadcast', 'request', 'response', 'event', 'command', 'query']),
    timestamp: zod_1.z.string(),
    payload: zod_1.z.any(),
    correlationId: zod_1.z.string().optional(),
    replyTo: zod_1.z.string().optional(),
    metadata: MessageMetadataSchema.optional(),
    signature: zod_1.z.string().optional(), // For message authentication
    version: zod_1.z.string().default('1.0')
});
const SubscriptionSchema = zod_1.z.object({
    agentId: zod_1.z.string(),
    topics: zod_1.z.array(zod_1.z.string()),
    patterns: zod_1.z.array(zod_1.z.string()).optional(),
    filter: zod_1.z.object({
        types: zod_1.z.array(zod_1.z.string()).optional(),
        priorities: zod_1.z.array(zod_1.z.string()).optional()
    }).optional()
});
// Circuit breaker pattern for resilience
class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000 // 1 minute
    ) {
        this.threshold = threshold;
        this.timeout = timeout;
        this.failures = 0;
        this.lastFailureTime = 0;
        this.state = 'closed';
    }
    async execute(fn) {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'half-open';
            }
            else {
                throw new Error('Circuit breaker is open');
            }
        }
        try {
            const result = await fn();
            if (this.state === 'half-open') {
                this.state = 'closed';
                this.failures = 0;
            }
            return result;
        }
        catch (error) {
            this.failures++;
            this.lastFailureTime = Date.now();
            if (this.failures >= this.threshold) {
                this.state = 'open';
            }
            throw error;
        }
    }
}
class MessageBusServer {
    constructor(redisUrl = 'redis://localhost:6379', password, secretKey) {
        const redisConfig = {
            password,
            retryStrategy: (times) => Math.min(times * 50, 2000),
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
            connectionTimeout: 10000,
            commandTimeout: 5000,
            keepAlive: 10000,
            enableOfflineQueue: true,
            lazyConnect: true // Don't connect until needed
        };
        this.publisher = new ioredis_1.default(redisUrl, redisConfig);
        this.subscriber = new ioredis_1.default(redisUrl, redisConfig);
        this.emitter = new eventemitter3_1.EventEmitter();
        this.subscriptions = new Map();
        this.messageHistory = new Map();
        this.circuitBreaker = new CircuitBreaker();
        this.secretKey = secretKey;
        this.metrics = {
            messagesPublished: 0,
            messagesReceived: 0,
            errors: 0
        };
        // Initialize MCP server
        this.mcpServer = new index_js_1.McpServer({
            name: 'message-bus',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {},
                resources: {
                    subscribe: true,
                    list: true
                }
            }
        });
        this.setupMcpTools();
        this.setupRedisHandlers();
        this.setupResourceHandlers();
    }
    setupResourceHandlers() {
        // Provide message history as resources
        this.mcpServer.setRequestHandler({
            method: 'resources/list',
            handler: async () => ({
                resources: Array.from(this.messageHistory.keys()).map(agentId => ({
                    uri: `message-bus://history/${agentId}`,
                    name: `Message History for ${agentId}`,
                    mimeType: 'application/json'
                }))
            })
        });
        this.mcpServer.setRequestHandler({
            method: 'resources/read',
            handler: async (request) => {
                const match = request.params.uri.match(/^message-bus:\/\/history\/(.+)$/);
                if (match) {
                    const agentId = match[1];
                    const messages = await this.getMessages(agentId);
                    return {
                        contents: [{
                                uri: request.params.uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(messages, null, 2)
                            }]
                    };
                }
                throw new Error('Resource not found');
            }
        });
    }
    setupMcpTools() {
        // Enhanced send message tool with validation
        this.mcpServer.setRequestHandler({
            method: 'tools/call',
            handler: async (request) => {
                try {
                    switch (request.params.name) {
                        case 'send_message': {
                            const args = SendMessageArgsSchema.parse(request.params.arguments);
                            // Validate agent permissions if needed
                            if (!await this.validateAgentPermission(args.from, 'send')) {
                                throw new Error('Agent not authorized to send messages');
                            }
                            const message = {
                                id: this.generateMessageId(),
                                from: args.from,
                                to: args.to,
                                type: args.type || 'direct',
                                timestamp: new Date().toISOString(),
                                payload: args.payload,
                                correlationId: args.correlationId,
                                replyTo: args.replyTo,
                                metadata: args.metadata,
                                version: '1.0'
                            };
                            // Sign message if secret key is available
                            if (this.secretKey) {
                                message.signature = this.signMessage(message);
                            }
                            await this.circuitBreaker.execute(() => this.publishMessage(message));
                            return {
                                content: [{
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            messageId: message.id,
                                            timestamp: message.timestamp
                                        })
                                    }]
                            };
                        }
                        case 'subscribe': {
                            const args = SubscribeArgsSchema.parse(request.params.arguments);
                            if (!await this.validateAgentPermission(args.agentId, 'subscribe')) {
                                throw new Error('Agent not authorized to subscribe');
                            }
                            await this.subscribe(args.agentId, args.topics, args.filter);
                            return {
                                content: [{
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            agentId: args.agentId,
                                            topics: args.topics,
                                            filter: args.filter
                                        })
                                    }]
                            };
                        }
                        case 'unsubscribe': {
                            const args = UnsubscribeArgsSchema.parse(request.params.arguments);
                            await this.unsubscribe(args.agentId, args.topics);
                            return {
                                content: [{
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            agentId: args.agentId,
                                            topics: args.topics
                                        })
                                    }]
                            };
                        }
                        case 'get_messages': {
                            const args = GetMessagesArgsSchema.parse(request.params.arguments);
                            const messages = await this.getMessages(args.agentId, args.since, args.limit, args.filter);
                            return {
                                content: [{
                                        type: 'text',
                                        text: JSON.stringify({
                                            success: true,
                                            count: messages.length,
                                            messages
                                        })
                                    }]
                            };
                        }
                        case 'health_check': {
                            const health = await this.healthCheck();
                            return {
                                content: [{
                                        type: 'text',
                                        text: JSON.stringify(health, null, 2)
                                    }]
                            };
                        }
                        case 'get_metrics': {
                            return {
                                content: [{
                                        type: 'text',
                                        text: JSON.stringify(this.metrics, null, 2)
                                    }]
                            };
                        }
                        default:
                            throw new Error(`Unknown tool: ${request.params.name}`);
                    }
                }
                catch (error) {
                    this.metrics.errors++;
                    this.metrics.lastError = error.message;
                    throw error;
                }
            }
        });
        // List available tools
        this.mcpServer.setRequestHandler({
            method: 'tools/list',
            handler: async () => ({
                tools: [
                    {
                        name: 'send_message',
                        description: 'Send a message through the message bus with enhanced features',
                        inputSchema: SendMessageArgsSchema
                    },
                    {
                        name: 'subscribe',
                        description: 'Subscribe an agent to topics with optional filters',
                        inputSchema: SubscribeArgsSchema
                    },
                    {
                        name: 'unsubscribe',
                        description: 'Unsubscribe an agent from specific topics',
                        inputSchema: UnsubscribeArgsSchema
                    },
                    {
                        name: 'get_messages',
                        description: 'Get messages for an agent with filtering options',
                        inputSchema: GetMessagesArgsSchema
                    },
                    {
                        name: 'health_check',
                        description: 'Check message bus health and connectivity',
                        inputSchema: {}
                    },
                    {
                        name: 'get_metrics',
                        description: 'Get message bus performance metrics',
                        inputSchema: {}
                    }
                ]
            })
        });
    }
    setupRedisHandlers() {
        // Enhanced Redis setup with better error handling
        this.subscriber.on('ready', async () => {
            console.log('Subscriber connected to Redis');
            // Re-subscribe to all patterns after reconnection
            await this.subscriber.psubscribe('agent:*');
            await this.subscriber.psubscribe('topic:*');
        });
        this.subscriber.on('pmessage', async (pattern, channel, data) => {
            try {
                const message = JSON.parse(data);
                // Verify message signature if secret key is available
                if (this.secretKey && message.signature) {
                    if (!this.verifyMessage(message)) {
                        console.error('Invalid message signature, rejecting message');
                        return;
                    }
                }
                await this.handleMessage(channel, message);
                this.metrics.messagesReceived++;
            }
            catch (error) {
                console.error('Failed to handle message:', error);
                this.metrics.errors++;
            }
        });
        // Connection event handlers with reconnection logic
        this.publisher.on('connect', () => {
            console.log('Publisher connected to Redis');
        });
        this.publisher.on('error', (err) => {
            console.error('Publisher Redis error:', err);
            this.metrics.errors++;
        });
        this.subscriber.on('error', (err) => {
            console.error('Subscriber Redis error:', err);
            this.metrics.errors++;
        });
        // Handle disconnections
        this.publisher.on('close', () => {
            console.log('Publisher disconnected from Redis');
        });
        this.subscriber.on('close', () => {
            console.log('Subscriber disconnected from Redis');
        });
    }
    async publishMessage(message) {
        // Implement message routing based on type and metadata
        const channels = [];
        if (message.type === 'broadcast') {
            channels.push('agent:broadcast');
            // Also publish to topic channels if specified
            if (message.metadata?.topic) {
                channels.push(`topic:${message.metadata.topic}`);
            }
        }
        else {
            channels.push(`agent:${message.to}`);
        }
        // Apply TTL if specified
        const messageStr = JSON.stringify(message);
        const promises = channels.map(channel => this.publisher.publish(channel, messageStr));
        await Promise.all(promises);
        // Store in history with TTL support
        this.addToHistory(message.to, message);
        if (message.from !== message.to) {
            this.addToHistory(message.from, message);
        }
        this.metrics.messagesPublished++;
        // Set expiration if TTL is specified
        if (message.metadata?.ttl) {
            setTimeout(() => {
                this.removeFromHistory(message.id);
            }, message.metadata.ttl * 1000);
        }
    }
    async handleMessage(channel, message) {
        // Apply subscription filters
        const channelParts = channel.split(':');
        const channelType = channelParts[0];
        const channelTarget = channelParts[1];
        // Emit locally for any listeners
        this.emitter.emit('message', message);
        this.emitter.emit(`message:${message.type}`, message);
        // Handle different channel types
        if (channelType === 'agent') {
            if (channelTarget === 'broadcast') {
                // Store broadcast messages for subscribed agents
                for (const [agentId, subscription] of this.subscriptions) {
                    if (this.shouldReceiveMessage(subscription, message)) {
                        this.addToHistory(agentId, message);
                    }
                }
            }
        }
        else if (channelType === 'topic') {
            // Handle topic-based messages
            for (const [agentId, subscription] of this.subscriptions) {
                if (subscription.topics.includes(channelTarget) &&
                    this.shouldReceiveMessage(subscription, message)) {
                    this.addToHistory(agentId, message);
                }
            }
        }
    }
    shouldReceiveMessage(subscription, message) {
        if (!subscription.filter)
            return true;
        // Check type filter
        if (subscription.filter.types &&
            !subscription.filter.types.includes(message.type)) {
            return false;
        }
        // Check priority filter
        if (subscription.filter.priorities &&
            message.metadata?.priority &&
            !subscription.filter.priorities.includes(message.metadata.priority)) {
            return false;
        }
        return true;
    }
    addToHistory(agentId, message) {
        if (!this.messageHistory.has(agentId)) {
            this.messageHistory.set(agentId, []);
        }
        const history = this.messageHistory.get(agentId);
        history.push(message);
        // Keep only last 1000 messages per agent (configurable)
        const maxHistory = process.env.MAX_MESSAGE_HISTORY || 1000;
        if (history.length > maxHistory) {
            history.shift();
        }
    }
    removeFromHistory(messageId) {
        for (const [agentId, history] of this.messageHistory) {
            const index = history.findIndex(msg => msg.id === messageId);
            if (index !== -1) {
                history.splice(index, 1);
            }
        }
    }
    async subscribe(agentId, topics, filter) {
        const subscription = {
            agentId,
            topics,
            filter
        };
        this.subscriptions.set(agentId, subscription);
        // Subscribe to agent-specific channel
        await this.subscriber.subscribe(`agent:${agentId}`);
        // Subscribe to topic channels
        for (const topic of topics) {
            if (topic === 'broadcast') {
                await this.subscriber.subscribe('agent:broadcast');
            }
            else {
                await this.subscriber.subscribe(`topic:${topic}`);
            }
        }
    }
    async unsubscribe(agentId, topics) {
        if (!topics) {
            // Unsubscribe from everything
            this.subscriptions.delete(agentId);
            await this.subscriber.unsubscribe(`agent:${agentId}`);
        }
        else {
            // Unsubscribe from specific topics
            const subscription = this.subscriptions.get(agentId);
            if (subscription) {
                subscription.topics = subscription.topics.filter(t => !topics.includes(t));
                if (subscription.topics.length === 0) {
                    this.subscriptions.delete(agentId);
                }
            }
        }
    }
    async getMessages(agentId, since, limit = 50, filter) {
        let history = this.messageHistory.get(agentId) || [];
        // Apply time filter
        if (since) {
            const sinceTime = new Date(since).getTime();
            history = history.filter(msg => new Date(msg.timestamp).getTime() > sinceTime);
        }
        // Apply custom filters
        if (filter) {
            if (filter.type) {
                history = history.filter(msg => msg.type === filter.type);
            }
            if (filter.from) {
                history = history.filter(msg => msg.from === filter.from);
            }
            if (filter.correlationId) {
                history = history.filter(msg => msg.correlationId === filter.correlationId);
            }
        }
        // Apply limit
        return history.slice(-limit);
    }
    async healthCheck() {
        const publisherStatus = this.publisher.status;
        const subscriberStatus = this.subscriber.status;
        // Test Redis connectivity
        let redisLatency = -1;
        try {
            const start = Date.now();
            await this.publisher.ping();
            redisLatency = Date.now() - start;
        }
        catch (error) {
            console.error('Redis ping failed:', error);
        }
        return {
            status: publisherStatus === 'ready' && subscriberStatus === 'ready' ? 'healthy' : 'unhealthy',
            publisher: publisherStatus,
            subscriber: subscriberStatus,
            subscriptions: this.subscriptions.size,
            messageHistorySize: this.messageHistory.size,
            metrics: this.metrics,
            redisLatency,
            circuitBreakerState: this.circuitBreaker['state'],
            timestamp: new Date().toISOString()
        };
    }
    async validateAgentPermission(agentId, action) {
        // Implement your permission logic here
        // For now, allow all actions
        return true;
    }
    generateMessageId() {
        return `msg-${Date.now()}-${crypto_1.default.randomBytes(8).toString('hex')}`;
    }
    signMessage(message) {
        if (!this.secretKey)
            return '';
        const content = JSON.stringify({
            id: message.id,
            from: message.from,
            to: message.to,
            type: message.type,
            timestamp: message.timestamp,
            payload: message.payload
        });
        return crypto_1.default
            .createHmac('sha256', this.secretKey)
            .update(content)
            .digest('hex');
    }
    verifyMessage(message) {
        if (!this.secretKey || !message.signature)
            return false;
        const expectedSignature = this.signMessage(message);
        return crypto_1.default.timingSafeEqual(Buffer.from(message.signature), Buffer.from(expectedSignature));
    }
    async start() {
        // Connect to Redis before starting MCP server
        await Promise.all([
            this.publisher.connect(),
            this.subscriber.connect()
        ]);
        const transport = new index_js_1.StdioServerTransport();
        await this.mcpServer.connect(transport);
        console.error('Message Bus MCP Server started');
    }
    async stop() {
        // Graceful shutdown
        this.emitter.removeAllListeners();
        await Promise.all([
            this.publisher.quit(),
            this.subscriber.quit()
        ]);
        console.log('Message Bus stopped');
    }
}
exports.MessageBusServer = MessageBusServer;
// Enhanced argument schemas
const SendMessageArgsSchema = zod_1.z.object({
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    type: zod_1.z.enum(['direct', 'broadcast', 'request', 'response', 'event', 'command', 'query']).optional(),
    payload: zod_1.z.any(),
    correlationId: zod_1.z.string().optional(),
    replyTo: zod_1.z.string().optional(),
    metadata: zod_1.z.object({
        priority: zod_1.z.enum(['low', 'normal', 'high', 'critical']).optional(),
        ttl: zod_1.z.number().optional(),
        topic: zod_1.z.string().optional()
    }).optional()
});
const SubscribeArgsSchema = zod_1.z.object({
    agentId: zod_1.z.string(),
    topics: zod_1.z.array(zod_1.z.string()),
    filter: zod_1.z.object({
        types: zod_1.z.array(zod_1.z.string()).optional(),
        priorities: zod_1.z.array(zod_1.z.string()).optional()
    }).optional()
});
const UnsubscribeArgsSchema = zod_1.z.object({
    agentId: zod_1.z.string(),
    topics: zod_1.z.array(zod_1.z.string()).optional()
});
const GetMessagesArgsSchema = zod_1.z.object({
    agentId: zod_1.z.string(),
    since: zod_1.z.string().optional(),
    limit: zod_1.z.number().default(50),
    filter: zod_1.z.object({
        type: zod_1.z.string().optional(),
        from: zod_1.z.string().optional(),
        correlationId: zod_1.z.string().optional()
    }).optional()
});
// Main entry point
if (require.main === module) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD || 'mcp-redis-secret-2025';
    const secretKey = process.env.MESSAGE_BUS_SECRET || 'default-secret-key';
    const server = new MessageBusServer(redisUrl, redisPassword, secretKey);
    server.start().catch(console.error);
    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
    });
}
//# sourceMappingURL=message-bus-improved.js.map