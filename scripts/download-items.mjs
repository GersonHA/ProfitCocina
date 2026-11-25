/**
 * Descarga íconos de items de Albion desde el render OFICIAL a static/items/,
 * para servirlos desde nuestro propio sitio (la app nunca depende en vivo de
 * terceros, §5 del documento del proyecto).
 *
 * Fuente: https://render.albiononline.com/v1/item/{ID}.png
 * Idempotente: salta los que ya existen (usa --force para rebajarlos).
 *
 * Uso:
 *   node scripts/download-items.mjs
 *   node scripts/download-items.mjs --force
 */
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CDN = 'https://render.albiononline.com/v1/item';
const OUT = 'static/items';

// Mantener en sincronía con CATALOG_IMAGES de src/lib/items.ts.
const ITEMS = ['T3_WHEAT', 'T4_BREAD', 'T8_MEAT', 'T8_PUMPKIN', 'T8_MEAL_STEW'];

const force = process.argv.includes('--force');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(id) {
  const dest = join(OUT, `${id}.png`);
  if (!force && (await exists(dest))) {
    console.log(`·  ya está   ${id}`);
    return;
  }
  const res = await fetch(`${CDN}/${id}.png`);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`${id}: la respuesta no es imagen (${type})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`✓  ${id}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

await mkdir(OUT, { recursive: true });
for (const id of ITEMS) {
  await download(id);
}
console.log('\nListo. Imágenes en static/items/');
