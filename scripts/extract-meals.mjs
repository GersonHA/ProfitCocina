/**
 * Extrae del dump de Albion (ao-bin-dumps) las comidas cocinadas estándar
 * (sopa, ensalada, pastel, tortilla, guiso, sándwich, asado) de todos los tiers,
 * con su receta e ingredientes directos, y los nombres en español.
 *
 * Uso: node scripts/extract-meals.mjs <items-raw.json> <formatted-items.json>
 * Salida: scripts/meals-data.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const rawPath = process.argv[2];
const locPath = process.argv[3];

const root = JSON.parse(readFileSync(rawPath, 'utf8')).items;
const loc = JSON.parse(readFileSync(locPath, 'utf8'));

// Mapa uniquename -> nombre ES
const nameEs = new Map();
const locArr = Array.isArray(loc) ? loc : Object.values(loc);
for (const it of locArr) {
  const u = it.UniqueName || it['@uniquename'];
  const es = it.LocalizedNames && it.LocalizedNames['ES-ES'];
  if (u && es) nameEs.set(u, es);
}

const STD = /^T\d_MEAL_(SOUP|SALAD|PIE|OMELETTE|STEW|SANDWICH|ROAST)$/;

const cons = root.consumableitem;
const meals = cons.filter((x) => STD.test(x['@uniquename'] || ''));

function tierOf(id) {
  const m = id.match(/^T(\d)_/);
  return m ? Number(m[1]) : 8;
}
function categoriaIngrediente(id) {
  if (id.includes('_MEAL_')) return 'meal';
  if (id.includes('_MEAT') || id.includes('_FISH')) return 'meat';
  if (id.includes('_BREAD') || id.includes('_FLOUR') || id.includes('_BUTTER') || id.includes('BUNDLE')) return 'refined';
  if (id.includes('_EGG') || id.includes('_MILK')) return 'animal';
  return 'crop';
}

const mealsOut = [];
const ingredientIds = new Set();

for (const m of meals) {
  const id = m['@uniquename'];
  const cr = m.craftingrequirements;
  const req = Array.isArray(cr) ? cr[0] : cr;
  if (!req || !req.craftresource) continue;
  const res = Array.isArray(req.craftresource) ? req.craftresource : [req.craftresource];
  const ingredients = res.map((r) => ({ id: r['@uniquename'], qty: Number(r['@count']) }));
  for (const ing of ingredients) ingredientIds.add(ing.id);
  mealsOut.push({
    id,
    name_es: nameEs.get(id) ?? id,
    outputQty: Number(req['@amountcrafted']) || 1,
    station: 'Cook',
    ingredients,
  });
}

// Catálogo de items = comidas + todos los ingredientes directos.
const itemsOut = [];
const seen = new Set();
function pushItem(id) {
  if (seen.has(id)) return;
  seen.add(id);
  itemsOut.push({
    id,
    name_es: nameEs.get(id) ?? id,
    tier: tierOf(id),
    category: categoriaIngrediente(id),
  });
}
for (const m of mealsOut) {
  pushItem(m.id);
  for (const ing of m.ingredients) pushItem(ing.id);
}

mealsOut.sort((a, b) => a.id.localeCompare(b.id));
itemsOut.sort((a, b) => a.id.localeCompare(b.id));

writeFileSync('scripts/meals-data.json', JSON.stringify({ meals: mealsOut, items: itemsOut }, null, 2));

console.log('comidas:', mealsOut.length);
console.log('items (comidas + ingredientes):', itemsOut.length);
console.log('ingredientes únicos:', ingredientIds.size);
console.log('\nejemplos T8:');
for (const m of mealsOut.filter((x) => x.id.startsWith('T8_'))) {
  console.log(' ', m.id, '→', m.name_es, '| da', m.outputQty, '←', m.ingredients.map((i) => `${i.qty}x ${nameEs.get(i.id) ?? i.id}`).join(' + '));
}
console.log('\ningredientes sin nombre ES:', itemsOut.filter((i) => i.name_es === i.id).map((i) => i.id).join(', ') || '(ninguno)');
