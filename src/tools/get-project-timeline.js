import { loadDataset } from '../data/project-datasets.js';
import { timelineSchema } from '../data/project-schemas.js';
import { registerReadOnlyTool } from './read-only-tool.js';

export function registerGetProjectTimeline(server, options = {}) {
  const load = options.loadDataset ?? loadDataset;
  return registerReadOnlyTool(server, {
    name: 'get_project_timeline', title: 'Linha do tempo pública do Projeto FECCI',
    description: 'Retorna a sequência de etapas publicada no resumo do diário Borke, distinguindo marcos documentados e próximos passos. ' +
      'Não inventa datas: datas ausentes ficam null; registros sem posição cronológica confirmada aparecem separados. ' +
      'Não recebe argumentos. Inclui fontes e data de verificação.',
    outputSchema: timelineSchema, readData: () => load('timeline'),
  }, options);
}
