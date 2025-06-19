import { MessageBusServer } from '../src/message-bus';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('MessageBusServer', () => {
  let server: MessageBusServer;
  let mockPublisher: jest.Mocked<Redis>;
  let mockSubscriber: jest.Mocked<Redis>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock Redis instances
    mockPublisher = {
      status: 'ready',
      publish: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn()
    } as any;

    mockSubscriber = {
      status: 'ready',
      subscribe: jest.fn().mockResolvedValue('OK'),
      psubscribe: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK')
    } as any;

    // Mock Redis constructor
    (Redis as any).mockImplementation(() => {
      if ((Redis as any).mock.calls.length % 2 === 1) {
        return mockPublisher;
      }
      return mockSubscriber;
    });

    server = new MessageBusServer('redis://localhost:6379', 'test-password');
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('Message Publishing', () => {
    it('should publish direct messages to agent-specific channels', async () => {
      const message = {
        from: 'agent1',
        to: 'agent2',
        type: 'direct' as const,
        payload: { test: 'data' }
      };

      // Simulate MCP tool call
      const mcpServer = (server as any).mcpServer;
      const handler = mcpServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].method === 'tools/call'
      )[0].handler;

      const response = await handler({
        params: {
          name: 'send_message',
          arguments: message
        }
      });

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'agent:agent2',
        expect.stringContaining('"from":"agent1"')
      );
      expect(response.content[0].text).toContain('Message sent with ID:');
    });

    it('should publish broadcast messages to broadcast channel', async () => {
      const message = {
        from: 'agent1',
        to: 'all',
        type: 'broadcast' as const,
        payload: { announcement: 'Hello everyone' }
      };

      const mcpServer = (server as any).mcpServer;
      const handler = mcpServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].method === 'tools/call'
      )[0].handler;

      await handler({
        params: {
          name: 'send_message',
          arguments: message
        }
      });

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'agent:broadcast',
        expect.stringContaining('"type":"broadcast"')
      );
    });
  });

  describe('Subscriptions', () => {
    it('should subscribe agents to topics', async () => {
      const mcpServer = (server as any).mcpServer;
      const handler = mcpServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].method === 'tools/call'
      )[0].handler;

      const response = await handler({
        params: {
          name: 'subscribe',
          arguments: {
            agentId: 'agent1',
            topics: ['broadcast', 'notifications']
          }
        }
      });

      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('agent:agent1');
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith('agent:broadcast');
      expect(response.content[0].text).toContain('Subscribed agent1 to topics');
    });
  });

  describe('Message History', () => {
    it('should retrieve message history for an agent', async () => {
      // Add some messages to history first
      const mcpServer = (server as any).mcpServer;
      const handler = mcpServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].method === 'tools/call'
      )[0].handler;

      // Send a message
      await handler({
        params: {
          name: 'send_message',
          arguments: {
            from: 'agent1',
            to: 'agent2',
            payload: { test: 'message' }
          }
        }
      });

      // Get messages
      const response = await handler({
        params: {
          name: 'get_messages',
          arguments: {
            agentId: 'agent2'
          }
        }
      });

      const messages = JSON.parse(response.content[0].text);
      expect(messages).toBeInstanceOf(Array);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]).toHaveProperty('from', 'agent1');
      expect(messages[0]).toHaveProperty('to', 'agent2');
    });

    it('should filter messages by timestamp', async () => {
      const mcpServer = (server as any).mcpServer;
      const handler = mcpServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].method === 'tools/call'
      )[0].handler;

      const since = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

      const response = await handler({
        params: {
          name: 'get_messages',
          arguments: {
            agentId: 'agent1',
            since
          }
        }
      });

      const messages = JSON.parse(response.content[0].text);
      expect(messages).toBeInstanceOf(Array);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when Redis is connected', async () => {
      const mcpServer = (server as any).mcpServer;
      const handler = mcpServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].method === 'tools/call'
      )[0].handler;

      const response = await handler({
        params: {
          name: 'health_check',
          arguments: {}
        }
      });

      const health = JSON.parse(response.content[0].text);
      expect(health.status).toBe('healthy');
      expect(health.publisher).toBe('ready');
      expect(health.subscriber).toBe('ready');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool requests', async () => {
      const mcpServer = (server as any).mcpServer;
      const handler = mcpServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].method === 'tools/call'
      )[0].handler;

      await expect(handler({
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      })).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should handle invalid message arguments', async () => {
      const mcpServer = (server as any).mcpServer;
      const handler = mcpServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].method === 'tools/call'
      )[0].handler;

      await expect(handler({
        params: {
          name: 'send_message',
          arguments: {
            // Missing required fields
            payload: {}
          }
        }
      })).rejects.toThrow();
    });
  });

  describe('MCP Tool List', () => {
    it('should list all available tools', async () => {
      const mcpServer = (server as any).mcpServer;
      const handler = mcpServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].method === 'tools/list'
      )[0].handler;

      const response = await handler({});
      
      expect(response.tools).toHaveLength(4);
      expect(response.tools.map((t: any) => t.name)).toContain('send_message');
      expect(response.tools.map((t: any) => t.name)).toContain('subscribe');
      expect(response.tools.map((t: any) => t.name)).toContain('get_messages');
      expect(response.tools.map((t: any) => t.name)).toContain('health_check');
    });
  });
});