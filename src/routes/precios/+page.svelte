<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  interface Row {
    item_id: string;
    name: string;
    sell: number | null;
    buy: number | null;
    sell0: number | null;
    buy0: number | null;
  }

  function buildRows(): Row[] {
    return data.items.map((it) => {
      const l = data.latest[it.item_id] ?? { sell: null, buy: null };
      return { item_id: it.item_id, name: it.name_es, sell: l.sell, buy: l.buy, sell0: l.sell, buy0: l.buy };
    });
  }

  let rows = $state<Row[]>(buildRows());
  let saving = $state(false);
  let msg = $state('');
  let error = $state('');

  async function guardar() {
    error = '';
    msg = '';
    const server = data.group?.server ?? 'americas';
    const cambiados = rows.filter((r) => r.sell !== r.sell0 || r.buy !== r.buy0).filter((r) => r.sell != null || r.buy != null);
    if (cambiados.length === 0) {
      msg = 'No hay cambios que guardar.';
      return;
    }
    saving = true;
    try {
      const { error: e1 } = await supabase.from('price_snapshots').insert(
        cambiados.map((r) => ({
          item_id: r.item_id,
          city: 'Caerleon',
          server,
          sell_order_min: r.sell,
          buy_order_max: r.buy,
          source: 'manual',
        })),
      );
      if (e1) throw e1;
      msg = `Guardados ${cambiados.length} precios.`;
      await invalidateAll();
      rows = buildRows();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }
</script>

<section class="space-y-5">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Precios de mercado</h1>
    <button onclick={guardar} disabled={saving} class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-60">
      {saving ? 'Guardando…' : 'Guardar precios'}
    </button>
  </div>
  <p class="text-sm text-stone-400">Anota el precio de venta (orden de venta) y, si quieres, el de compra. El comparador de justicia los usa para calcular el valor de mercado.</p>

  {#if msg}<p class="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300">{msg}</p>{/if}
  {#if error}<p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>{/if}

  <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
    <div class="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-stone-800 pb-2 text-xs text-stone-500">
      <span>Item</span>
      <span class="w-28 text-right">Venta</span>
      <span class="w-28 text-right">Compra</span>
    </div>
    <div class="divide-y divide-stone-800">
      {#each rows as row}
        <div class="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2">
          <span class="flex items-center gap-2">
            <ItemImg itemId={row.item_id} nombre={row.name} size={24} />
            <span class="text-sm">{row.name}</span>
          </span>
          <input type="number" bind:value={row.sell} min="0" placeholder="—" class="w-28 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-right text-sm" />
          <input type="number" bind:value={row.buy} min="0" placeholder="—" class="w-28 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-right text-sm" />
        </div>
      {/each}
    </div>
  </div>
</section>
