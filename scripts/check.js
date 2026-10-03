import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : entry.name.endsWith('.js') ? [path] : [];
  });
}

const files = ['server.js', ...['src', 'scripts', 'test'].flatMap(javascriptFiles)].sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) {
    console.error(`Não foi possível verificar ${file}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Sintaxe verificada em ${files.length} arquivos JavaScript.`);
