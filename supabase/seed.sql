-- Catálogo mínimo para el MVP: las cadenas de pan, calabaza y ternera + el
-- guiso de ternera T8. Se ejecuta automáticamente en `supabase db reset`.
-- Idempotente. El catálogo completo se importará desde ao-bin-dumps en la Fase 3.

insert into public.items (item_id, name_es, tier, enchant, category, nutrition) values
  -- Semillas / crías
  ('T3_FARM_WHEAT_SEED',   'Semillas de trigo',    3, 0, 'seed',   null),
  ('T8_FARM_PUMPKIN_SEED', 'Semillas de calabaza', 8, 0, 'seed',   null),
  ('T8_FARM_COW_BABY',     'Ternero',              8, 0, 'animal', null),
  ('T8_FARM_COW_GROWN',    'Vaca',                 8, 0, 'animal', null),
  -- Cultivos / intermedios / productos
  ('T3_WHEAT',     'Trigo',            3, 0, 'crop',    null),
  ('T3_FLOUR',     'Harina',           3, 0, 'refined', null),
  ('T4_BREAD',     'Pan',              4, 0, 'meal',    null),
  ('T8_MEAT',      'Carne de ternera', 8, 0, 'meat',    null),
  ('T8_PUMPKIN',   'Calabaza',         8, 0, 'crop',    null),
  ('T8_MEAL_STEW', 'Guiso de ternera', 8, 0, 'meal',    690)
on conflict (item_id) do update
  set name_es = excluded.name_es, tier = excluded.tier,
      category = excluded.category, nutrition = excluded.nutrition;

-- Recetas de fabricación (cantidades nominales; el retorno de recursos da más).
insert into public.recipes (output_item, output_qty, station, focus_cost) values
  ('T3_FLOUR',     1,  'Mill',    null),   -- trigo -> harina
  ('T4_BREAD',     1,  'Cook',    null),   -- harina -> pan
  ('T8_MEAT',      18, 'Butcher', null),   -- 1 vaca -> 18 carne
  ('T8_MEAL_STEW', 10, 'Cook',    null)    -- 36 calabaza + 36 pan + 72 carne -> 10 guiso
on conflict (output_item) do update
  set output_qty = excluded.output_qty, station = excluded.station;

insert into public.recipe_ingredients (recipe_id, item_id, qty)
select r.id, x.item_id, x.qty
from public.recipes r
join (values
  ('T3_FLOUR',     'T3_WHEAT',          1),
  ('T4_BREAD',     'T3_FLOUR',          1),
  ('T8_MEAT',      'T8_FARM_COW_GROWN', 1),
  ('T8_MEAL_STEW', 'T8_PUMPKIN',        36),
  ('T8_MEAL_STEW', 'T4_BREAD',          36),
  ('T8_MEAL_STEW', 'T8_MEAT',           72)
) as x (output_item, item_id, qty) on x.output_item = r.output_item
on conflict (recipe_id, item_id) do update set qty = excluded.qty;
