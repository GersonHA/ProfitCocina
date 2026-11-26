/**
 * Genera supabase/seed_meals.sql a partir de scripts/meals-data.json:
 * items (comidas + ingredientes), recetas y sus ingredientes. Idempotente.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const { meals, items } = JSON.parse(readFileSync('scripts/meals-data.json', 'utf8'));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

let sql = `-- =====================================================================
-- Catálogo de comidas cocinadas de Albion (21 líneas estándar) + sus
-- ingredientes directos. Generado por scripts/gen-meals-sql.mjs desde el
-- dump oficial (ao-bin-dumps). Idempotente.
-- =====================================================================

insert into public.items (item_id, name_es, tier, enchant, category, nutrition) values
${items.map((i) => `  (${q(i.id)}, ${q(i.name_es)}, ${i.tier}, ${i.enchant ?? 0}, ${q(i.category)}, null)`).join(',\n')}
on conflict (item_id) do update set name_es = excluded.name_es;

insert into public.recipes (output_item, output_qty, station, focus_cost) values
${meals.map((m) => `  (${q(m.id)}, ${m.outputQty}, 'Cook', null)`).join(',\n')}
on conflict (output_item) do update set output_qty = excluded.output_qty, station = excluded.station;

insert into public.recipe_ingredients (recipe_id, item_id, qty)
select r.id, x.item_id, x.qty
from public.recipes r
join (values
${meals.flatMap((m) => m.ingredients.map((ing) => `  (${q(m.id)}, ${q(ing.id)}, ${ing.qty})`)).join(',\n')}
) as x (output_item, item_id, qty) on x.output_item = r.output_item
on conflict (recipe_id, item_id) do update set qty = excluded.qty;
`;

writeFileSync('supabase/seed_meals.sql', sql);
// Lista de ids para el descargador de imágenes.
writeFileSync('scripts/meal-image-ids.json', JSON.stringify(items.map((i) => i.id), null, 2));
console.log('SQL escrito:', meals.length, 'recetas,', items.length, 'items');
