/**
 * Copia ACTIVECAMPAIGN_* do .env da raiz para supabase/.env
 * (usado por supabase functions serve / secrets set)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, '.env');
const dest = path.join(root, 'supabase', '.env');

if (!fs.existsSync(src)) {
  console.error('Arquivo .env não encontrado na raiz do projeto.');
  process.exit(1);
}

const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const acLines = [
  '# Auto-gerado por npm run ac:env-sync — não edite; altere o .env da raiz',
  '',
];
let found = 0;

for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  if (/^ACTIVECAMPAIGN_/i.test(t)) {
    acLines.push(line);
    found++;
  }
}

if (found === 0) {
  console.warn(
    'Nenhuma variável ACTIVECAMPAIGN_* no .env. Adicione ACTIVECAMPAIGN_URL e ACTIVECAMPAIGN_API_KEY.',
  );
}

fs.writeFileSync(dest, acLines.join('\n') + '\n', 'utf8');
console.log(`supabase/.env atualizado (${found} variável(is) ActiveCampaign).`);
