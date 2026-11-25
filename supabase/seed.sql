-- Catálogo mínimo para el MVP: el guiso de ternera T8 y la cadena de pan.
-- Se ejecuta automáticamente en `supabase db reset`. Idempotente.
-- El catálogo completo se importará desde ao-bin-dumps en la Fase 3.

insert into public.items (item_id, name_es, tier, enchant, category, nutrition) values
  ('T3_WHEAT',     'Trigo',            3, 0, 'crop', null),
  ('T4_BREAD',     'Pan',              4, 0, 'meal', null),
  ('T8_MEAT',      'Carne de ternera', 8, 0, 'meat', null),
  ('T8_PUMPKIN',   'Calabaza',         8, 0, 'crop', null),
  ('T8_MEAL_STEW', 'Guiso de ternera', 8, 0, 'meal', 690)
on conflict (item_id) do update
  set name_es = excluded.name_es, tier = excluded.tier,
      category = excluded.category, nutrition = excluded.nutrition;

-- Receta del guiso de ternera T8: 36 calabazas + 72 terneras + 36 panes -> 10 guisos (Cook).
insert into public.recipes (output_item, output_qty, station, focus_cost)
values ('T8_MEAL_STEW', 10, 'Cook', null)
on conflict (output_item) do update
  set output_qty = excluded.output_qty, station = excluded.station;

insert into public.recipe_ingredients (recipe_id, item_id, qty)
select r.id, x.item_id, x.qty
from public.recipes r
cross join (values ('T8_PUMPKIN', 36), ('T8_MEAT', 72), ('T4_BREAD', 36)) as x (item_id, qty)
where r.output_item = 'T8_MEAL_STEW'
on conflict (recipe_id, item_id) do update set qty = excluded.qty;
