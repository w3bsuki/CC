const redis = require('redis');
const { v4: uuidv4 } = require('uuid');

class SimpleMessageBus {
  constructor(redisUrl = 'redis://localhost:6380', redisPassword) {
    this.redisUrl = redisUrl;
    this.redisPassword = redisPassword;
    this.publisher = null;
    this.subscriber = null;
    this.messageHandlers = new Map();
    this.messageQueue = new Map();
  }

  async connect() {
    const options = {
      socket: {
        host: 'localhost',
        port: 6380
      },
      password: this.redisPassword || process.env.REDIS_PASSWORD
    };

    // Create publisher client
    this.publisher = redis.createClient(options);
    this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));
    await this.publisher.connect();

    // Create subscriber client
    this.subscriber = redis.createClient(options);
    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
    await this.subscriber.connect();

    console.log('✅ Message bus connected to Redis');
  }

  async disconnect() {
    if (this.publisher) await this.publisher.quit();
    if (this.subscriber) await this.subscriber.quit();
  }

  async sendMessage(from, to, type, payload, options = {}) {
    const messageId = options.correlationId || uuidv4();
    
    const message = {
      id: messageId,
      from,
      to,
      type,
      payload,
      timestamp: new Date().toISOString(),
      correlationId: options.correlationId,
      replyTo: options.replyTo
    };

    // Publish to specific channel
    const channel = `messages:${to}`;
    await this.publisher.publish(channel, JSON.stringify(message));

    // Store in queue for reliability
    const queueKey = `queue:${to}`;
    await this.publisher.lPush(queueKey, JSON.stringify(message));
    await this.publisher.expire(queueKey, 3600); // 1 hour TTL

    return messageId;
  }

  async subscribe(channel, handler) {
    const redisChannel = `messages:${channel}`;
    
    await this.subscriber.subscribe(redisChannel, (message) => {
      try {
        const parsed = JSON.parse(message);
        handler(parsed);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    this.messageHandlers.set(channel, handler);
  }

  async getMessages(agentId, limit = 10) {
    const queueKey = `queue:${agentId}`;
    const messages = await this.publisher.lRange(queueKey, 0, limit - 1);
    
    return messages.map(msg => {
      try {
        return JSON.parse(msg);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  async healthCheck() {
    try {
      await this.publisher.ping();
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = { SimpleMessageBus };