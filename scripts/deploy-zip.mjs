// Gera zeyforge-web.zip com o build web (dist/) para hospedagem estática (InfinityFree, Hostinger, Netlify…).
import { zipSync } from 'fflate';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'dist';
const files = {};
const walk = d => readdirSync(d).forEach(f => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : (files[relative(root, p).replace(/\\/g, '/')] = readFileSync(p)); });
walk(root);
writeFileSync('zeyforge-web.zip', zipSync(files, { level: 9 }));
console.log(`zeyforge-web.zip gerado (${Object.keys(files).length} arquivos). Extraia dentro de htdocs/ no InfinityFree.`);
