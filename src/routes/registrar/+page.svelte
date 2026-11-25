<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { recompute } from '$lib/recompute';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  const TIPOS = [
    { value: 'siembra', label: 'Siembra / cosecha' },
    { value: 'cria', label: 'Cría' },
    { value: 'refinado', label: 'Refinado / intermedio' },
    { value: 'cocina', label: 'Cocina' },
  ];

  const GASTOS = ['semillas', 'crias', 'estacion', 'transporte', 'otros'];

  function hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function firstItem(): string {
    return data.items[0]?.item_id ?? '';
  }

  let tipo = $state('siembra');
  let fecha = $state(hoy());
  let city = $state('');
  let focusUsed = $state(false);
  let focusAmount = $state<number | null>(null);
  let notes = $state('');

  let inputs = $state<{ itemId: string; qty: number | null }[]>([]);
  let outputs = $state<{ itemId: string; qty: number | null; role: 'principal' | 'subproducto'; valuation: number | null }[]>([
    { itemId: firstItem(), qty: null, role: 'principal', valuation: null },
  ]);
  let expenses = $state<{ kind: string; silver: number | null }[]>([{ kind: 'semillas', silver: null }]);

  let saving = $state(false);
  let error = $state('');
  let warn = $state('');

  function addInput() {
    inputs.push({ itemId: firstItem(), qty: null });
  }
  function addOutput() {
    outputs.push({ itemId: firstItem(), qty: null, role: 'principal', valuation: null });
  }
  function addExpense() {
    expenses.push({ kind: 'otros', silver: null });
  }
  function nombre(id: string): string {
    return data.items.find((i) => i.item_id === id)?.name_es ?? id;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    warn = '';

    if (!data.group) {
      error = 'No tienes un grupo activo.';
      return;
    }
    const outs = outputs.filter((o) => o.itemId && (o.qty ?? 0) > 0);
    if (!outs.some((o) => o.role === 'principal')) {
      error = 'Necesitas al menos una salida principal con cantidad.';
      return;
    }

    saving = true;
    try {
      const { data: proc, error: e1 } = await supabase
        .from('processes')
        .insert({
          group_id: data.group.id,
          type: tipo,
          fecha,
          city: city.trim() || null,
          focus_used: focusUsed,
          focus_amount: focusUsed ? focusAmount : null,
          notes: notes.trim() || null,
        })
        .select('id')
        .single();
      if (e1) throw e1;
      const pid = proc.id;

      const ins = inputs.filter((i) => i.itemId && (i.qty ?? 0) > 0);
      if (ins.length) {
        const { error: e2 } = await supabase
          .from('process_inputs')
          .insert(ins.map((i) => ({ process_id: pid, item_id: i.itemId, qty: i.qty })));
        if (e2) throw e2;
      }

      const { error: e3 } = await supabase.from('process_outputs').insert(
        outs.map((o) => ({
          process_id: pid,
          item_id: o.itemId,
          qty: o.qty,
          role: o.role,
          valuation: o.role === 'subproducto' ? o.valuation : null,
        })),
      );
      if (e3) throw e3;

      const exps = expenses.filter((x) => (x.silver ?? 0) > 0);
      if (exps.length) {
        const { error: e4 } = await supabase
          .from('process_expenses')
          .insert(exps.map((x) => ({ process_id: pid, kind: x.kind, silver: x.silver })));
        if (e4) throw e4;
      }

      // Recalcular el Kardex en el servidor.
      try {
        await recompute(data.group.id);
      } catch (re) {
        // El lote quedó guardado; solo falló el recálculo (p. ej. fn:serve apagado).
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
  <h1 class="text-2xl font-semibold">Registrar un lote</h1>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
      No tienes un grupo activo. Pide que te inviten a uno.
    </p>
  {:else}
    <form onsubmit={submit} class="space-y-5">
      <!-- Datos del lote -->
      <div class="grid grid-cols-2 gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <label class="col-span-2 sm:col-span-1">
          <span class="mb-1 block text-xs text-stone-400">Tipo</span>
          <select bind:value={tipo} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
            {#each TIPOS as t}
              <option value={t.value}>{t.label}</option>
            {/each}
          </select>
        </label>
        <label class="col-span-2 sm:col-span-1">
          <span class="mb-1 block text-xs text-stone-400">Fecha</span>
          <input type="date" bind:value={fecha} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
        </label>
        <label class="col-span-2 sm:col-span-1">
          <span class="mb-1 block text-xs text-stone-400">Ciudad / isla (opcional)</span>
          <input type="text" bind:value={city} placeholder="Caerleon, mi isla…" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
        </label>
        <div class="col-span-2 flex items-center gap-3 sm:col-span-1">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={focusUsed} class="size-4" />
            Usé foco
          </label>
          {#if focusUsed}
            <input type="number" bind:value={focusAmount} placeholder="cantidad" min="0" class="w-28 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          {/if}
        </div>
      </div>

      <!-- Entradas -->
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Entradas (se descuentan del inventario)</h2>
          <button type="button" onclick={addInput} class="rounded-lg border border-stone-700 px-2 py-1 text-xs hover:bg-stone-800">+ agregar</button>
        </div>
        {#if inputs.length === 0}
          <p class="text-sm text-stone-500">Sin entradas (p. ej. una siembra solo gasta silver).</p>
        {/if}
        <div class="space-y-2">
          {#each inputs as row, i}
            <div class="flex items-center gap-2">
              <ItemImg itemId={row.itemId} nombre={nombre(row.itemId)} size={24} />
              <select bind:value={row.itemId} class="flex-1 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-sm">
                {#each data.items as it}
                  <option value={it.item_id}>{it.name_es}</option>
                {/each}
              </select>
              <input type="number" bind:value={row.qty} placeholder="cant." min="0" class="w-24 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-sm" />
              <button type="button" onclick={() => inputs.splice(i, 1)} class="text-stone-500 hover:text-red-400" aria-label="quitar">✕</button>
            </div>
          {/each}
        </div>
      </div>

      <!-- Gastos -->
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Gastos en silver</h2>
          <button type="button" onclick={addExpense} class="rounded-lg border border-stone-700 px-2 py-1 text-xs hover:bg-stone-800">+ agregar</button>
        </div>
        <div class="space-y-2">
          {#each expenses as row, i}
            <div class="flex items-center gap-2">
              <select bind:value={row.kind} class="flex-1 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-sm">
                {#each GASTOS as g}
                  <option value={g}>{g}</option>
                {/each}
              </select>
              <input type="number" bind:value={row.silver} placeholder="silver" min="0" class="w-32 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-sm" />
              <button type="button" onclick={() => expenses.splice(i, 1)} class="text-stone-500 hover:text-red-400" aria-label="quitar">✕</button>
            </div>
          {/each}
        </div>
      </div>

      <!-- Salidas -->
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Salidas (lo que produjiste)</h2>
          <button type="button" onclick={addOutput} class="rounded-lg border border-stone-700 px-2 py-1 text-xs hover:bg-stone-800">+ agregar</button>
        </div>
        <div class="space-y-2">
          {#each outputs as row, i}
            <div class="flex flex-wrap items-center gap-2">
              <ItemImg itemId={row.itemId} nombre={nombre(row.itemId)} size={24} />
              <select bind:value={row.itemId} class="min-w-32 flex-1 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-sm">
                {#each data.items as it}
                  <option value={it.item_id}>{it.name_es}</option>
                {/each}
              </select>
              <input type="number" bind:value={row.qty} placeholder="cant." min="0" class="w-20 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-sm" />
              <select bind:value={row.role} class="rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-sm">
                <option value="principal">principal</option>
                <option value="subproducto">subproducto</option>
              </select>
              {#if row.role === 'subproducto'}
                <input type="number" bind:value={row.valuation} placeholder="costo c/u" min="0" class="w-24 rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-sm" />
              {/if}
              {#if outputs.length > 1}
                <button type="button" onclick={() => outputs.splice(i, 1)} class="text-stone-500 hover:text-red-400" aria-label="quitar">✕</button>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Notas (opcional)</span>
        <input type="text" bind:value={notes} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>

      {#if error}
        <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      {/if}
      {#if warn}
        <p class="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Lote guardado, pero no se pudo recalcular el Kardex: {warn}
          <a href="/mi-produccion" class="underline">Ir a Mi producción</a>
        </p>
      {/if}

      <button
        type="submit"
        disabled={saving}
        class="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60"
      >
        {saving ? 'Guardando…' : 'Registrar lote'}
      </button>
    </form>
  {/if}
</section>
