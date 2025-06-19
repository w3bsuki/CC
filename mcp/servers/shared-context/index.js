#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs-extra');
const path = require('path');

const CONTEXT_PATH = process.env.CONTEXT_PATH || path.join(__dirname, '../../../workspaces/shared/context');

class SharedContextServer {
  constructor() {
    this.server = new Server({
      name: 'shared-context',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_context',
            description: 'Read context data by key',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string' }
              },
              required: ['key']
            }
          },
          {
            name: 'write_context',
            description: 'Write context data',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                value: { type: 'object' }
              },
              required: ['key', 'value']
            }
          },
          {
            name: 'list_contexts',
            description: 'List all available context keys',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'read_context':
          return { content: [{ type: 'text', text: await this.readContext(args.key) }] };
        case 'write_context':
          return { content: [{ type: 'text', text: await this.writeContext(args.key, args.value) }] };
        case 'list_contexts':
          return { content: [{ type: 'text', text: await this.listContexts() }] };
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async readContext(key) {
    try {
      const filePath = path.join(CONTEXT_PATH, `${key}.json`);
      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);
        return JSON.stringify(data, null, 2);
      }
      return 'Context not found';
    } catch (error) {
      return `Error reading context: ${error.message}`;
    }
  }

  async writeContext(key, value) {
    try {
      await fs.ensureDir(CONTEXT_PATH);
      const filePath = path.join(CONTEXT_PATH, `${key}.json`);
      await fs.writeJson(filePath, value, { spaces: 2 });
      return `Context written: ${key}`;
    } catch (error) {
      throw new Error(`Failed to write context: ${error.message}`);
    }
  }

  async listContexts() {
    try {
      await fs.ensureDir(CONTEXT_PATH);
      const files = await fs.readdir(CONTEXT_PATH);
      const contexts = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
      return JSON.stringify(contexts, null, 2);
    } catch (error) {
      return JSON.stringify([], null, 2);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Shared Context MCP server running');
  }
}

const server = new SharedContextServer();
server.run().catch(console.error);