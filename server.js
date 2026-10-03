import { once } from 'node:events';
import { createApp } from './src/app.js';
import { readConfig } from './src/config.js';

async function main() {
  const config = readConfig();
  const httpServer = createApp(config).listen(config.port, config.host);
  await once(httpServer, 'listening');

  const hostname = config.host.includes(':') ? `[${config.host}]` : config.host;
  console.log(`FECCI Fusion 360 MCP disponível em http://${hostname}:${config.port}/mcp`);

  let stopping = false;
  function shutdown() {
    if (stopping) return;
    stopping = true;
    console.log('Encerrando o servidor MCP...');

    const timeout = setTimeout(() => {
      httpServer.closeAllConnections();
      process.exitCode = 1;
    }, 10_000);
    timeout.unref();

    httpServer.close((error) => {
      clearTimeout(timeout);
      if (error) {
        console.error('Erro ao encerrar o servidor:', error.message);
        process.exitCode = 1;
      }
    });
    httpServer.closeIdleConnections();
  }

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Não foi possível iniciar o servidor MCP:', error.message);
  process.exitCode = 1;
});
