"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleMessageBus = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const eventemitter3_1 = require("eventemitter3");
class SimpleMessageBus {
    constructor(redisUrl = 'redis://localhost:6379', password) {
        const redisConfig = {
            password,
            retryStrategy: (times) => Math.min(times * 50, 2000),
            enableReadyCheck: true,
            maxRetriesPerRequest: 3
        };
        this.publisher = new ioredis_1.default(redisUrl, redisConfig);
        this.subscriber = new ioredis_1.default(redisUrl, redisConfig);
        this.emitter = new eventemitter3_1.EventEmitter();
        this.messageHistory = new Map();
        this.setupRedisHandlers();
    }
    setupRedisHandlers() {
        // Subscribe to all agent channels
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
        // Connection handlers
        this.publisher.on('connect', () => {
            console.log('Publisher connected to Redis');
        });
        this.subscriber.on('connect', () => {
            console.log('Subscriber connected to Redis');
        });
    }
    async sendMessage(from, to, type, payload, options) {
        const message = {
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
    subscribe(agentId, callback) {
        // Subscribe to agent-specific channel
        this.subscriber.subscribe(`agent:${agentId}`);
        // Subscribe to broadcast channel
        this.subscriber.subscribe('agent:broadcast');
        // Register callback
        this.emitter.on(`message:${agentId}`, callback);
    }
    handleMessage(channel, message) {
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
            }
            else {
                // Emit to specific agent
                this.emitter.emit(`message:${targetAgent}`, message);
            }
        }
    }
    addToHistory(agentId, message) {
        if (!this.messageHistory.has(agentId)) {
            this.messageHistory.set(agentId, []);
        }
        const history = this.messageHistory.get(agentId);
        history.push(message);
        // Keep only last 1000 messages
        if (history.length > 1000) {
            history.shift();
        }
    }
    getMessages(agentId, since) {
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
exports.SimpleMessageBus = SimpleMessageBus;
//# sourceMappingURL=simple-message-bus.js.map