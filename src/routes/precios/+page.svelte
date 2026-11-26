<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import PriceChart from '$lib/components/PriceChart.svelte';

  let { data } = $props();

  const CIUDADES = ['Caerleon', 'Martlock', 'Fort Sterling', 'Thetford', 'Lymhurst', 'Bridgewatch', 'Brecilien'];

  function ayer(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // --- Formulario de registro ---
  interface Row {
    item_id: string;
    name: string;
    venta: number | null;
    compra: number | null;
    volumen: number | null;
  }
  function buildRows(): Row[] {
    return data.items.map((it) => ({ item_id: it.item_id, name: it.name_es, venta: null, compra: null, volumen: null }));
  }

  let fecha = $state(ayer());
  let ciudad = $state('Caerleon');
  let rows = $state<Row[]>(buildRows());
  let saving = $state(false);
  let msg = $state('');
  let error = $state('');

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
      rows = buildRows();
      await invalidateAll();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }

  // --- Gráfico ---
  function primerItem(): string {
    return data.items[0]?.item_id ?? '';
  }
  let gItem = $state(primerItem());
  let gCiudad = $state('Caerleon');

  const serie = $derived.by(() => {
    const byFecha = new Map<string, { precio: number; volumen: number }>();
    for (const s of data.snaps) {
      if (s.item_id !== gItem || s.city !== gCiudad) continue;
      byFecha.set(s.fecha, { precio: Number(s.sell_order_min) || 0, volumen: Number(s.volume) || 0 });
    }
    const fechas = [...byFecha.keys()].sort();
    return {
      labels: fechas,
      precio: fechas.map((f) => byFecha.get(f)!.precio),
      volumen: fechas.map((f) => byFecha.get(f)!.volumen),
    };
  });
</script>

<section class="space-y-6">
  <div>
    <h1 class="text-2xl font-semibold">Precios de mercado</h1>
    <p class="mt-1 text-sm text-stone-400">
      Anota el precio y el volumen de cada item, por ciudad y por día (puedes poner el de ayer). Cualquiera del grupo puede registrar.
    </p>
  </div>

  <!-- Registro -->
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

  <!-- Gráfico -->
  <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
    <div class="mb-3 flex flex-wrap items-end gap-3">
      <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Historial</h2>
      <label class="ml-auto block">
        <span class="mb-1 block text-xs text-stone-400">Item</span>
        <select bind:value={gItem} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
          {#each data.items as it}<option value={it.item_id}>{it.name_es}</option>{/each}
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Ciudad</span>
        <select bind:value={gCiudad} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
          {#each CIUDADES as c}<option value={c}>{c}</option>{/each}
        </select>
      </label>
    </div>

    {#if serie.labels.length === 0}
      <p class="py-8 text-center text-sm text-stone-500">Todavía no hay precios registrados para ese item y ciudad.</p>
    {:else}
      <PriceChart labels={serie.labels} precio={serie.precio} volumen={serie.volumen} />
    {/if}
  </div>
</section>
