<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { recompute } from '$lib/recompute';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  function hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function nombre(id: string): string {
    return data.items.find((i) => i.item_id === id)?.name_es ?? id;
  }
  function firstItem(): string {
    return data.items[0]?.item_id ?? '';
  }

  const KINDS = ['conteo', 'perdida', 'consumo', 'otros'];

  let mode = $state<'conteo' | 'delta'>('conteo');
  let itemId = $state(firstItem());
  let real = $state<number | null>(null); // cantidad real en el juego (modo conteo)
  let delta = $state<number | null>(null); // +/- directo (modo delta)
  let unitCost = $state<number | null>(null); // costo c/u para deltas positivos sin stock
  let kind = $state('conteo');
  let reason = $state('');
  let fecha = $state(hoy());

  let saving = $state(false);
  let error = $state('');
  let warn = $state('');

  const actual = $derived(data.balances[itemId] ?? 0);
  const deltaConteo = $derived((real ?? 0) - actual);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    warn = '';
    if (!data.group) return;
    if (!reason.trim()) {
      error = 'El motivo es obligatorio.';
      return;
    }

    const qtyDelta = mode === 'conteo' ? deltaConteo : (delta ?? 0);
    if (!qtyDelta) {
      error = mode === 'conteo' ? 'El conteo coincide con el sistema: no hay ajuste.' : 'Indica cuánto ajustar (+/−).';
      return;
    }
    const kindFinal = mode === 'conteo' ? 'conteo' : kind;

    saving = true;
    try {
      const { error: e1 } = await supabase.from('stock_adjustments').insert({
        group_id: data.group.id,
        item_id: itemId,
        qty_delta: qtyDelta,
        unit_cost: qtyDelta > 0 && mode === 'delta' ? unitCost : null,
        kind: kindFinal,
        reason: reason.trim(),
        fecha,
      });
      if (e1) throw e1;

      try {
        await recompute(data.group.id);
      } catch (re) {
        warn = re instanceof Error ? re.message : String(re);
        saving = false;
        return;
      }
      await goto('/mi-produccion');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      saving = false;
    }
  }
</script>

<section class="space-y-5">
  <div class="flex items-center gap-2 text-sm text-stone-400">
    <a href="/registrar" class="hover:text-stone-200">Registrar</a> <span>/</span> <span class="text-stone-200">Ajuste de stock</span>
  </div>
  <h1 class="text-2xl font-semibold">Ajuste de stock</h1>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else}
    <form onsubmit={submit} class="space-y-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <div class="flex gap-2">
        <button
          type="button"
          onclick={() => (mode = 'conteo')}
          class="flex-1 rounded-xl border px-4 py-2 font-medium transition {mode === 'conteo'
            ? 'border-amber-500 bg-amber-500/15 text-amber-300'
            : 'border-stone-700 text-stone-400 hover:bg-stone-800'}"
        >
          Conteo
        </button>
        <button
          type="button"
          onclick={() => (mode = 'delta')}
          class="flex-1 rounded-xl border px-4 py-2 font-medium transition {mode === 'delta'
            ? 'border-amber-500 bg-amber-500/15 text-amber-300'
            : 'border-stone-700 text-stone-400 hover:bg-stone-800'}"
        >
          Ajuste directo
        </button>
      </div>

      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Item</span>
        <div class="flex items-center gap-2">
          <ItemImg {itemId} nombre={nombre(itemId)} size={26} />
          <select bind:value={itemId} class="flex-1 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
            {#each data.items as it}
              <option value={it.item_id}>{it.name_es}</option>
            {/each}
          </select>
        </div>
      </label>

      {#if mode === 'conteo'}
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-lg bg-stone-800/40 px-3 py-2 text-sm">
            <span class="block text-xs text-stone-500">En el sistema</span>
            <span class="tabular-nums">{Math.round(actual).toLocaleString('es-ES')}</span>
          </div>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Cantidad real en el juego</span>
            <input type="number" bind:value={real} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
        </div>
        {#if real !== null}
          <p class="text-sm text-stone-400">
            Ajuste: <span class="tabular-nums {deltaConteo < 0 ? 'text-red-300' : deltaConteo > 0 ? 'text-green-300' : 'text-stone-300'}">{deltaConteo > 0 ? '+' : ''}{deltaConteo}</span>
          </p>
        {/if}
      {:else}
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Ajuste (+/−)</span>
            <input type="number" bind:value={delta} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Motivo</span>
            <select bind:value={kind} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
              {#each KINDS as k}
                <option value={k}>{k}</option>
              {/each}
            </select>
          </label>
          {#if (delta ?? 0) > 0}
            <label class="col-span-2 block">
              <span class="mb-1 block text-xs text-stone-400">Costo por unidad (si no hay stock previo)</span>
              <input type="number" bind:value={unitCost} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
            </label>
          {/if}
        </div>
      {/if}

      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Motivo (obligatorio)</span>
        <input type="text" bind:value={reason} placeholder="Murió en el camino, consumo propio…" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>

      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Fecha</span>
        <input type="date" bind:value={fecha} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>

      {#if error}
        <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      {/if}
      {#if warn}
        <p class="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Guardado, pero no se pudo recalcular: {warn} <a href="/mi-produccion" class="underline">Ir a Mi producción</a>
        </p>
      {/if}

      <button type="submit" disabled={saving} class="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60">
        {saving ? 'Guardando…' : 'Registrar ajuste'}
      </button>
    </form>
  {/if}
</section>
