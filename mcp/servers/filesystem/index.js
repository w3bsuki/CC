const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs').promises;
const path = require('path');

const server = new Server({
  name: 'filesystem',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

const ALLOWED_PATH = process.env.FILESYSTEM_ROOT || process.cwd();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_file',
        description: 'Read contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to workspace' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write contents to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to workspace' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_directory',
        description: 'List contents of a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path relative to workspace' }
          },
          required: ['path']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fullPath = path.join(ALLOWED_PATH, args.path || '');
  
  switch (name) {
    case 'read_file':
      const content = await fs.readFile(fullPath, 'utf8');
      return { content: [{ type: 'text', text: content }] };
      
    case 'write_file':
      await fs.writeFile(fullPath, args.content);
      return { content: [{ type: 'text', text: 'File written successfully' }] };
      
    case 'list_directory':
      const files = await fs.readdir(fullPath);
      return { content: [{ type: 'text', text: files.join('\n') }] };
      
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Filesystem MCP server running');
}

main().catch(console.error);
