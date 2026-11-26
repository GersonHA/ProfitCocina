<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  const CIUDADES = ['Caerleon', 'Martlock', 'Fort Sterling', 'Thetford', 'Lymhurst', 'Bridgewatch', 'Brecilien'];

  function ayer(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  interface Row {
    item_id: string;
    name: string;
    venta: number | null;
    compra: number | null;
    volumen: number | null;
  }

  /** Último precio conocido de un item en una ciudad (snaps vienen ordenados por fecha asc). */
  function ultimo(item: string, city: string) {
    let r: (typeof data.snaps)[number] | null = null;
    for (const s of data.snaps) if (s.item_id === item && s.city === city) r = s;
    return r;
  }
  function buildRows(city: string): Row[] {
    return data.items.map((it) => {
      const r = ultimo(it.item_id, city);
      return {
        item_id: it.item_id,
        name: it.name_es,
        venta: r?.sell_order_min ?? null,
        compra: r?.buy_order_max ?? null,
        volumen: r?.volume ?? null,
      };
    });
  }

  let fecha = $state(ayer());
  let ciudad = $state('Caerleon');
  let rows = $state<Row[]>([]);
  let saving = $state(false);
  let msg = $state('');
  let error = $state('');

  // Pre-llena con el último precio conocido de la ciudad elegida (para no partir de cero).
  $effect(() => {
    rows = buildRows(ciudad);
  });

  async function guardar() {
    error = '';
    msg = '';
    const cambiados = rows.filter((r) => r.venta != null || r.compra != null || r.volumen != null);
    if (cambiados.length === 0) {
      msg = 'Pon al menos un precio o volumen.';
      return;
    }
    saving = true;
    try {
      const { error: e1 } = await supabase.from('price_snapshots').insert(
        cambiados.map((r) => ({
          item_id: r.item_id,
          city: ciudad,
          server: data.group?.server ?? 'americas',
          fecha,
          sell_order_min: r.venta,
          buy_order_max: r.compra,
          volume: r.volumen,
          source: 'manual',
        })),
      );
      if (e1) throw e1;
      msg = `Guardados ${cambiados.length} precios de ${ciudad} (${fecha}).`;
      await invalidateAll();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }
</script>

<section class="space-y-6">
  <div>
    <h1 class="text-2xl font-semibold">Precios de mercado</h1>
    <p class="mt-1 text-sm text-stone-400">
      Anota el precio y el volumen de cada item, por ciudad y por día (puedes poner el de ayer). Cualquiera del grupo puede registrar.
      El gráfico vive en el <a href="/" class="text-amber-300 underline">Panel</a>.
    </p>
  </div>

  <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
    <div class="mb-3 flex flex-wrap items-end gap-3">
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Día del precio</span>
        <input type="date" bind:value={fecha} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Ciudad</span>
        <select bind:value={ciudad} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
          {#each CIUDADES as c}<option value={c}>{c}</option>{/each}
        </select>
      </label>
      <button onclick={guardar} disabled={saving} class="ml-auto rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-60">
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>

    <p class="mb-3 text-xs text-stone-500">Pre-llenado con el último precio conocido de {ciudad}; ajústalo al del día.</p>

    {#if msg}<p class="mb-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300">{msg}</p>{/if}
    {#if error}<p class="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>{/if}

    <div class="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-stone-800 pb-2 text-xs text-stone-500">
      <span>Item</span>
      <span class="w-24 text-right">Venta</span>
      <span class="w-24 text-right">Compra</span>
      <span class="w-24 text-right">Volumen</span>
    </div>
    <div class="divide-y divide-stone-800">
      {#each rows as row}
        <div class="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2">
          <span class="flex items-center gap-2">
            <ItemImg itemId={row.item_id} nombre={row.name} size={24} />
            <span class="text-sm">{row.name}</span>
          </span>
          <input type="number" bind:value={row.venta} min="0" placeholder="—" class="w-24 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-right text-sm" />
          <input type="number" bind:value={row.compra} min="0" placeholder="—" class="w-24 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-right text-sm" />
          <input type="number" bind:value={row.volumen} min="0" placeholder="—" class="w-24 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-right text-sm" />
        </div>
      {/each}
    </div>
  </div>
</section>
