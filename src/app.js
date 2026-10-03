import express from 'express';
import { hostHeaderValidation } from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcp-server.js';

function rpcError(res, status, code, message) {
  return res.status(status).json({
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  });
}

export function createApp({
  allowedHosts = ['localhost', '127.0.0.1', '[::1]'],
  allowedOrigins = [],
  logger = console,
  loadProjectInfo,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(hostHeaderValidation(allowedHosts));
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin !== undefined && !allowedOrigins.includes(origin)) {
      return rpcError(res, 403, -32000, 'Origin não permitida.');
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));

  app.post('/mcp', async (req, res) => {
    let server;
    try {
      // Cada requisição usa um servidor/transporte independente no modo stateless.
      server = createMcpServer({ loadProjectInfo, logger });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.once('close', () => {
        server.close().catch((error) => logger.error('Erro ao fechar transporte MCP:', error));
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Erro ao processar requisição MCP:', error);
      if (!res.headersSent) {
        rpcError(res, 500, -32603, 'Erro interno ao processar a requisição MCP.');
      } else if (!res.writableEnded) {
        res.destroy();
      }
    }
  });

  // Sem sessões ou notificações do servidor, GET/SSE e DELETE não são necessários.
  app.all('/mcp', (_req, res) => {
    res.set('Allow', 'POST');
    rpcError(res, 405, -32000, 'Método não permitido. Use POST no endpoint /mcp.');
  });

  app.use((_req, res) => {
    rpcError(res, 404, -32000, 'Endpoint não encontrado.');
  });

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return res.destroy();
    if (error.type === 'entity.parse.failed') {
      return rpcError(res, 400, -32700, 'JSON inválido.');
    }
    if (error.type === 'entity.too.large') {
      return rpcError(res, 413, -32000, 'Corpo da requisição excede o limite de 64 KiB.');
    }
    logger.error('Erro HTTP:', error);
    return rpcError(res, 500, -32603, 'Erro interno do servidor.');
  });

  return app;
}
