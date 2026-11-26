/**
 * Extrae del dump de Albion (ao-bin-dumps) las comidas cocinadas estándar
 * (sopa, ensalada, pastel, tortilla, guiso, sándwich, asado) de todos los tiers,
 * EN SUS 4 CALIDADES (base + encantado @1/@2/@3). El encantado usa la receta
 * base + una salsa (T1_FISHSAUCE_LEVEL{1,2,3}). Nombres en español.
 *
 * Uso: node scripts/extract-meals.mjs <items-raw.json> <formatted-items.json>
 * Salida: scripts/meals-data.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const root = JSON.parse(readFileSync(process.argv[2], 'utf8')).items;
const loc = JSON.parse(readFileSync(process.argv[3], 'utf8'));

const nameEs = new Map();
for (const it of Array.isArray(loc) ? loc : Object.values(loc)) {
  const u = it.UniqueName || it['@uniquename'];
  const es = it.LocalizedNames && it.LocalizedNames['ES-ES'];
  if (u && es) nameEs.set(u, es);
}

const STD = /^T\d_MEAL_(SOUP|SALAD|PIE|OMELETTE|STEW|SANDWICH|ROAST)$/;
const meals = root.consumableitem.filter((x) => STD.test(x['@uniquename'] || ''));

const tierOf = (id) => {
  const m = id.match(/^T(\d)_/);
  return m ? Number(m[1]) : 8;
};
function categoria(id) {
  if (id.includes('_MEAL_')) return 'meal';
  if (id.includes('SAUCE')) return 'condimento';
  if (id.includes('_MEAT') || id.includes('_FISH')) return 'meat';
  if (id.includes('_BREAD') || id.includes('_FLOUR') || id.includes('_BUTTER') || id.includes('BUNDLE')) return 'refined';
  if (id.includes('_EGG') || id.includes('_MILK')) return 'animal';
  return 'crop';
}
const toIngs = (cr) => {
  const res = cr.craftresource ? (Array.isArray(cr.craftresource) ? cr.craftresource : [cr.craftresource]) : [];
  return res.map((r) => ({ id: r['@uniquename'], qty: Number(r['@count']) }));
};

const mealsOut = [];
for (const m of meals) {
  const baseId = m['@uniquename'];
  const base = Array.isArray(m.craftingrequirements) ? m.craftingrequirements[0] : m.craftingrequirements;
  if (!base) continue;
  const name = nameEs.get(baseId) ?? baseId;
  const tier = tierOf(baseId);

  // Calidad base (encantamiento 0)
  mealsOut.push({ id: baseId, baseId, enchant: 0, name_es: name, tier, outputQty: Number(base['@amountcrafted']) || 1, station: 'Cook', ingredients: toIngs(base) });

  // Calidades encantadas (@1/@2/@3)
  const enc = m.enchantments && m.enchantments.enchantment;
  for (const e of enc ? (Array.isArray(enc) ? enc : [enc]) : []) {
    const lvl = Number(e['@enchantmentlevel']);
    const cr = e.craftingrequirements;
    if (!cr) continue;
    mealsOut.push({
      id: `${baseId}@${lvl}`,
      baseId,
      enchant: lvl,
      name_es: name,
      tier,
      outputQty: Number(cr['@amountcrafted']) || 1,
      station: 'Cook',
      ingredients: toIngs(cr),
    });
  }
}

// Catálogo de items: cada variante de comida + todos los ingredientes.
const itemsOut = [];
const seen = new Set();
function pushItem(id, enchant) {
  if (seen.has(id)) return;
  seen.add(id);
  itemsOut.push({ id, name_es: nameEs.get(id.split('@')[0]) ?? id, tier: tierOf(id), enchant, category: categoria(id) });
}
for (const m of mealsOut) {
  pushItem(m.id, m.enchant);
  for (const ing of m.ingredients) pushItem(ing.id, ing.id.includes('@') ? Number(ing.id.split('@')[1]) : 0);
}

mealsOut.sort((a, b) => a.baseId.localeCompare(b.baseId) || a.enchant - b.enchant);
itemsOut.sort((a, b) => a.id.localeCompare(b.id));

writeFileSync('scripts/meals-data.json', JSON.stringify({ meals: mealsOut, items: itemsOut }, null, 2));
// El listado de imágenes (todas las ids, incluidas las encantadas) lo escribe
// scripts/gen-meals-sql.mjs.

console.log('comidas (con calidades):', mealsOut.length, '| base:', mealsOut.filter((m) => m.enchant === 0).length);
console.log('items:', itemsOut.length);
console.log('salsas:', itemsOut.filter((i) => i.category === 'condimento').map((i) => i.id + '=' + i.name_es).join(', '));
console.log('\nGuiso de ternera (4 calidades):');
for (const m of mealsOut.filter((x) => x.baseId === 'T8_MEAL_STEW'))
  console.log(' ', m.id.padEnd(16), '←', m.ingredients.map((i) => `${i.qty}x ${nameEs.get(i.id) ?? i.id}`).join(' + '));
