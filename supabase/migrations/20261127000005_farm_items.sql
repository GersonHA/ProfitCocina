-- Ítems de granja (semillas y animales) que faltaban en el catálogo, necesarios
-- para las cadenas de producción guiadas de todos los recursos.
-- Los procesos referencian items(item_id) con FK, así que deben existir aquí.

insert into public.items (item_id, name_es, tier, enchant, category) values
  -- Semillas de cultivo
  ('T1_FARM_CARROT_SEED',  'Semillas de zanahoria', 1, 0, 'seed'),
  ('T2_FARM_BEAN_SEED',    'Semillas de frijol',    2, 0, 'seed'),
  ('T4_FARM_TURNIP_SEED',  'Semillas de rábano',    4, 0, 'seed'),
  ('T5_FARM_CABBAGE_SEED', 'Semillas de col',       5, 0, 'seed'),
  ('T6_FARM_POTATO_SEED',  'Semillas de patata',    6, 0, 'seed'),
  ('T7_FARM_CORN_SEED',    'Semillas de maíz',      7, 0, 'seed'),
  -- Animales: cría -> adulto
  ('T3_FARM_CHICKEN_BABY',  'Polluelo', 3, 0, 'animal'),
  ('T3_FARM_CHICKEN_GROWN', 'Gallina',  3, 0, 'animal'),
  ('T4_FARM_GOAT_BABY',     'Cabrito',  4, 0, 'animal'),
  ('T4_FARM_GOAT_GROWN',    'Cabra',    4, 0, 'animal'),
  ('T5_FARM_GOOSE_BABY',    'Ansarón',  5, 0, 'animal'),
  ('T5_FARM_GOOSE_GROWN',   'Ganso',    5, 0, 'animal'),
  ('T6_FARM_SHEEP_BABY',    'Cordero',  6, 0, 'animal'),
  ('T6_FARM_SHEEP_GROWN',   'Oveja',    6, 0, 'animal'),
  ('T7_FARM_PIG_BABY',      'Lechón',   7, 0, 'animal'),
  ('T7_FARM_PIG_GROWN',     'Cerdo',    7, 0, 'animal')
on conflict (item_id) do nothing;
