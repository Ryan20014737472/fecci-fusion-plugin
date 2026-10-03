import { z } from 'zod';
import { getProjectInfo, projectInfoSchema } from '../data/project-info.js';

export function registerGetProjectInfo(server, {
  loadProjectInfo = getProjectInfo,
  logger = console,
} = {}) {
  server.registerTool(
    'get_project_info',
    {
      title: 'Informações gerais do Projeto FECCI',
      description: 'Retorna nome, descrição, áreas abordadas, site oficial e informações públicas ' +
        'sobre o Projeto FECCI, seu minicurso e o estágio dos resultados. Inclui fontes e a data ' +
        'da consulta ao site. Não recebe argumentos e não altera dados.',
      inputSchema: z.strictObject({}),
      outputSchema: projectInfoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const info = await loadProjectInfo();
        return {
          structuredContent: info,
          content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
        };
      } catch (error) {
        logger.error('Erro ao carregar informações do projeto:', error);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: 'Não foi possível carregar as informações públicas do Projeto FECCI.',
          }],
        };
      }
    },
  );
}
