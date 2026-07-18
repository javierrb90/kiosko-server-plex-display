import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const syntaxOnly = process.argv.includes('--syntax-only');
const jsFiles = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'data') continue;
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) walk(file);
    else if (file.endsWith('.js') || file.endsWith('.mjs')) jsFiles.push(file);
  }
}
walk(root);
for (const file of jsFiles) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
console.log(`Sintaxis válida: ${jsFiles.length} archivos JavaScript.`);
if (syntaxOnly) process.exit(0);

const server = readFileSync(join(root, 'server.js'), 'utf8');
const routes = [...server.matchAll(/app\.(get|post|put|patch|delete)\("([^"]+)"/g)].map(m => `${m[1].toUpperCase()} ${m[2]}`);
const duplicates = routes.filter((route, index) => routes.indexOf(route) !== index);
if (duplicates.length) {
  console.error('Rutas duplicadas:', [...new Set(duplicates)].join(', '));
  process.exitCode = 1;
} else {
  console.log(`Rutas HTTP sin duplicados: ${routes.length}.`);
}
const forbiddenDocs = readdirSync(join(root, 'docs')).filter(name => /^RELEASE|^PRODUCTION-ENV-V5/i.test(name));
if (forbiddenDocs.length) {
  console.error('Documentación histórica suelta detectada:', forbiddenDocs.join(', '));
  process.exitCode = 1;
}
console.log('Comprobación estructural completada.');
