import { z } from 'zod';

export function registerReadOnlyTool(server, {
  name, title, description, outputSchema, readData,
  inputSchema = z.strictObject({}),
}, { logger = console } = {}) {
  return server.registerTool(name, {
    title, description, inputSchema, outputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async (args) => {
    try {
      const data = outputSchema.parse(await readData(args));
      return { structuredContent: data, content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      logger.error(`Erro na ferramenta ${name}:`, error);
      return {
        isError: true,
        content: [{ type: 'text', text: 'Não foi possível consultar as informações públicas solicitadas do Projeto FECCI.' }],
      };
    }
  });
}
