import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import packageInfo from '../package.json' with { type: 'json' };
import { registerTools } from './tools/index.js';

export function createMcpServer(options = {}) {
  const server = new McpServer(
    {
      name: 'fecci-fusion-360',
      title: 'FECCI Fusion 360',
      version: packageInfo.version,
    },
    {
      instructions: 'Consulte informações públicas do Projeto FECCI. Os dados são um retrato ' +
        'verificado do site oficial na data indicada em source_checked_at. Preserve as fontes ' +
        'e a distinção entre etapas concluídas, próximas etapas e resultados ainda não publicados.',
    },
  );
  registerTools(server, options);
  return server;
}
