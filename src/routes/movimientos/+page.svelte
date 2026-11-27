<script lang="ts">
  import { base } from '$app/paths';
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { recompute } from '$lib/recompute';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import type { EventRow } from './+page';

  let { data } = $props();

  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });
  function emsg(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
    return String(e);
  }

  const TIPO_CLASE: Record<string, string> = {
    Compra: 'bg-sky-500/15 text-sky-300',
    Venta: 'bg-green-500/15 text-green-300',
    'Venta en curso': 'bg-amber-500/15 text-amber-300',
    'Venta cancelada': 'bg-stone-700/40 text-stone-400',
    Producción: 'bg-violet-500/15 text-violet-300',
    Ajuste: 'bg-stone-700/40 text-stone-300',
    Pérdida: 'bg-red-500/15 text-red-300',
  };

  let busyId = $state<string | null>(null);
  let error = $state('');
  let msg = $state('');

  // Edición en línea (solo compras/ventas: precio y cantidad).
  let editId = $state<string | null>(null);
  let editQty = $state<number | null>(null);
  let editPrice = $state<number | null>(null);

  function empezarEdicion(ev: EventRow) {
    editId = ev.id;
    editQty = ev.qty;
    editPrice = ev.priceUnit;
    error = '';
    msg = '';
  }

  async function guardarEdicion(ev: EventRow) {
    if (!data.group) return;
    if ((editQty ?? 0) <= 0 || (editPrice ?? 0) < 0) {
      error = 'Cantidad y precio deben ser válidos.';
      return;
    }
    busyId = ev.id;
    error = '';
    try {
      const { error: e1 } = await supabase
        .from('market_txns')
        .update({ qty: editQty, price_unit: editPrice })
        .eq('id', ev.id);
      if (e1) throw e1;
      await recompute(data.group.id);
      msg = 'Movimiento corregido. Kardex recalculado.';
      editId = null;
      await invalidateAll();
    } catch (err) {
      error = emsg(err);
    } finally {
      busyId = null;
    }
  }

  async function eliminar(ev: EventRow) {
    if (!data.group) return;
    if (!confirm(`¿Eliminar este movimiento?\n\n${ev.tipo}: ${fmt(ev.qty)} × ${ev.desc}\n\nEl inventario y los costos se recalcularán.`)) return;
    busyId = ev.id;
    error = '';
    msg = '';
    try {
      const { error: e1 } = await supabase.from(ev.table).delete().eq('id', ev.id);
      if (e1) throw e1;
      await recompute(data.group.id);
      msg = 'Movimiento eliminado. Kardex recalculado.';
      await invalidateAll();
    } catch (err) {
      error = emsg(err);
    } finally {
      busyId = null;
    }
  }
</script>

<section class="space-y-5">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Movimientos</h1>
      <p class="text-sm text-stone-400">Todo lo que registraste. Si algo salió mal, elimínalo y los costos se recalculan solos.</p>
    </div>
    <a href="{base}/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">🏠 Inicio</a>
  </div>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else}
    {#if error}<p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>{/if}
    {#if msg}<p class="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300">{msg}</p>{/if}

    {#if data.eventos.length === 0}
      <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">Aún no hay movimientos registrados.</p>
    {:else}
      <div class="overflow-hidden rounded-2xl border border-stone-800">
        {#each data.eventos as ev (ev.table + ev.id)}
          <div class="border-b border-stone-800 bg-stone-900/40 px-4 py-2.5 last:border-b-0">
            <div class="flex items-center gap-3">
              <span class="hidden w-20 shrink-0 text-xs text-stone-500 tabular-nums sm:inline">{ev.fecha}</span>
              <span class="w-28 shrink-0"><span class="rounded-full px-2 py-0.5 text-xs {TIPO_CLASE[ev.tipo] ?? 'bg-stone-700/40 text-stone-300'}">{ev.tipo}</span></span>
              <ItemImg itemId={ev.itemId} nombre={ev.desc} size={22} />
              <span class="min-w-0 flex-1 truncate text-sm">
                <span class="tabular-nums text-stone-400">{fmt(ev.qty)}×</span> {ev.desc}
                {#if ev.editable}<span class="text-xs text-stone-500">a {fmt(ev.priceUnit)} c/u</span>{:else if ev.valor > 0}<span class="text-xs text-stone-500">· {fmt(ev.valor)}</span>{/if}
              </span>
              {#if ev.editable && editId !== ev.id}
                <button onclick={() => empezarEdicion(ev)} disabled={busyId === ev.id} class="shrink-0 rounded-lg border border-stone-700 px-2.5 py-1 text-xs text-stone-300 transition hover:bg-stone-800 disabled:opacity-40">Editar</button>
              {/if}
              <button
                onclick={() => eliminar(ev)}
                disabled={busyId === ev.id}
                class="shrink-0 rounded-lg border border-red-500/40 px-2.5 py-1 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
              >
                {busyId === ev.id ? '…' : 'Eliminar'}
              </button>
            </div>

            {#if editId === ev.id}
              <div class="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-stone-950/50 p-3">
                <label class="block">
                  <span class="mb-1 block text-xs text-stone-400">Cantidad</span>
                  <input type="number" bind:value={editQty} min="0" class="w-28 rounded-lg border border-stone-700 bg-stone-950 px-3 py-1.5 text-sm tabular-nums" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs text-stone-400">Precio por unidad</span>
                  <input type="number" bind:value={editPrice} min="0" class="w-32 rounded-lg border border-stone-700 bg-stone-950 px-3 py-1.5 text-sm tabular-nums" />
                </label>
                <span class="pb-1.5 text-xs text-stone-500">= {fmt((editQty ?? 0) * (editPrice ?? 0))}</span>
                <div class="ml-auto flex gap-2">
                  <button onclick={() => (editId = null)} class="rounded-lg border border-stone-700 px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800">Cancelar</button>
                  <button onclick={() => guardarEdicion(ev)} disabled={busyId === ev.id} class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-stone-950 hover:bg-amber-400 disabled:opacity-60">{busyId === ev.id ? 'Guardando…' : 'Guardar'}</button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
      <p class="text-xs text-stone-600">Se muestran los últimos 100 movimientos. Eliminar es permanente, pero siempre puedes volver a registrar el correcto.</p>
    {/if}
  {/if}
</section>
