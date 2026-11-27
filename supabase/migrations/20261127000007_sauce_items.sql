-- Intermedios de las salsas de pescado (para las cadenas guiadas de salsas).
-- Las salsas (T1_FISHSAUCE_LEVEL1/2/3) ya están en el catálogo; faltan sus
-- ingredientes: picadillo de pescado y algas.

insert into public.items (item_id, name_es, tier, enchant, category) values
  ('T1_FISHCHOPS', 'Picadillo de pescado', 1, 0, 'refined'),
  ('T1_SEAWEED',   'Algas',               1, 0, 'fish')
on conflict (item_id) do nothing;
