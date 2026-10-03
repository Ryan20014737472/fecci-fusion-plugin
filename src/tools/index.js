import { registerGetProjectInfo } from './get-project-info.js';

export function registerTools(server, options = {}) {
  registerGetProjectInfo(server, options);
  // Adicione os próximos registradores aqui, cada um em seu próprio módulo.
}
