<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { recompute } from '$lib/recompute';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import type { ChainStep } from '$lib/chains';

  let {
    step,
    groupId,
    names,
    balances = {},
    runStep,
    startOpen = false,
  }: {
    step: ChainStep;
    groupId: string;
    names: Record<string, string>;
    balances?: Record<string, number>;
    runStep?: { id: string; runId: string; idx: number; total: number };
    startOpen?: boolean;
  } = $props();

  // Cuánto tienes disponible de un item (para precargar / mostrar en gris).
  function disp(id: string | undefined): number {
    return id ? Math.floor(balances[id] ?? 0) : 0;
  }
  const fmtDisp = (n: number) => n.toLocaleString('es-ES', { useGrouping: 'always' });

  function hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function nombre(id: string | undefined): string {
    return id ? (names[id] ?? id) : '';
  }

  function initOpen() {
    return startOpen;
  }
  let open = $state(initOpen());
  // Precarga lo que se consume con lo que tienes disponible (p. ej. refinar TODO el trigo).
  function initInput() {
    return step.inputItem && disp(step.inputItem) > 0 ? disp(step.inputItem) : null;
  }
  function initFeed() {
    return step.feedItem && disp(step.feedItem) > 0 ? disp(step.feedItem) : null;
  }
  let inputQty = $state<number | null>(initInput());
  let outputQty = $state<number | null>(null);
  let subQty = $state<number | null>(null);
  let feedQty = $state<number | null>(initFeed());
  let silver = $state<number | null>(null);
  let price = $state<number | null>(null);
  let fecha = $state(hoy());
  let saving = $state(false);
  let error = $state('');
  let ok = $state(false);

  function reset() {
    inputQty = outputQty = subQty = feedQty = silver = price = null;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    ok = false;
    if ((outputQty ?? 0) <= 0) {
      error = 'Indica la cantidad obtenida.';
      return;
    }
    saving = true;
    try {
      let procId: string | null = null;
      let tradeId: string | null = null;
      if (step.kind === 'comprar') {
        const { data: t, error: e1 } = await supabase
          .from('market_txns')
          .insert({
            group_id: groupId,
            item_id: step.outputItem,
            qty: outputQty,
            price_unit: price ?? 0,
            kind: 'buy',
            fecha,
          })
          .select('id')
          .single();
        if (e1) throw e1;
        tradeId = t.id;
      } else {
        const { data: proc, error: e1 } = await supabase
          .from('processes')
          .insert({ group_id: groupId, type: step.processType, fecha })
          .select('id')
          .single();
        if (e1) throw e1;
        const pid = proc.id;
        procId = pid;

        const ins: Array<{ process_id: string; item_id: string; qty: number }> = [];
        if (step.inputItem && (inputQty ?? 0) > 0) {
          ins.push({ process_id: pid, item_id: step.inputItem, qty: inputQty! });
        }
        if (step.feedItem && (feedQty ?? 0) > 0) {
          ins.push({ process_id: pid, item_id: step.feedItem, qty: feedQty! });
        }
        if (ins.length) {
          const { error: e2 } = await supabase.from('process_inputs').insert(ins);
          if (e2) throw e2;
        }

        const outs: Array<{ process_id: string; item_id: string; qty: number; role: string }> = [
          { process_id: pid, item_id: step.outputItem, qty: outputQty!, role: 'principal' },
        ];
        if (step.subproductItem && (subQty ?? 0) > 0) {
          outs.push({ process_id: pid, item_id: step.subproductItem, qty: subQty!, role: 'subproducto' });
        }
        const { error: e3 } = await supabase.from('process_outputs').insert(outs);
        if (e3) throw e3;

        if ((silver ?? 0) > 0) {
          const kind = step.station ? 'estacion' : 'otros';
          const { error: e4 } = await supabase
            .from('process_expenses')
            .insert({ process_id: pid, kind, silver });
          if (e4) throw e4;
        }
      }

      // Si es parte de un lote, marca el paso hecho y avanza el estado.
      if (runStep) {
        await supabase
          .from('run_steps')
          .update({ done: true, qty: outputQty, silver: silver ?? null, process_id: procId, trade_id: tradeId, done_at: new Date().toISOString() })
          .eq('id', runStep.id);
        const nextIdx = runStep.idx + 1;
        await supabase
          .from('production_runs')
          .update({ state: nextIdx >= runStep.total ? 'completado' : 'en_curso', step_index: nextIdx, updated_at: new Date().toISOString() })
          .eq('id', runStep.runId);
      }

      await recompute(groupId);
      await invalidateAll();
      reset();
      ok = true;
      open = false;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }
</script>

<div class="rounded-xl border border-stone-800 bg-stone-900/50">
  <button
    type="button"
    onclick={() => (open = !open)}
    class="flex w-full items-center gap-3 px-4 py-3 text-left"
  >
    <ItemImg itemId={step.outputItem} nombre={nombre(step.outputItem)} size={28} />
    <span class="flex-1">
      <span class="block font-medium">{step.label}</span>
      {#if step.station}<span class="block text-xs text-stone-500">Estación: {step.station}</span>{/if}
    </span>
    {#if ok}<span class="text-xs text-green-400">✓ guardado</span>{/if}
    <span class="text-stone-500">{open ? '▲' : '▼'}</span>
  </button>

  {#if open}
    <form onsubmit={submit} class="space-y-3 border-t border-stone-800 px-4 py-3">
      {#if step.kind === 'comprar'}
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Cantidad comprada</span>
            <input type="number" bind:value={outputQty} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Precio por unidad</span>
            <input type="number" bind:value={price} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
        </div>
      {:else if step.kind === 'cosechar'}
        <div class="grid grid-cols-3 gap-2">
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Semillas plantadas {#if disp(step.inputItem)}<span class="text-stone-600">({fmtDisp(disp(step.inputItem))} disp.)</span>{/if}</span>
            <input type="number" bind:value={inputQty} min="0" placeholder={disp(step.inputItem) ? fmtDisp(disp(step.inputItem)) : ''} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Cosechado</span>
            <input type="number" bind:value={outputQty} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Semillas devueltas</span>
            <input type="number" bind:value={subQty} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
        </div>
      {:else if step.kind === 'criar'}
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">{nombre(step.inputItem)} usados {#if disp(step.inputItem)}<span class="text-stone-600">({fmtDisp(disp(step.inputItem))} disp.)</span>{/if}</span>
            <input type="number" bind:value={inputQty} min="0" placeholder={disp(step.inputItem) ? fmtDisp(disp(step.inputItem)) : ''} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">{nombre(step.outputItem)} obtenidas</span>
            <input type="number" bind:value={outputQty} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          {#if step.feedItem}
            <label class="block">
              <span class="mb-1 flex items-center gap-1.5 text-xs text-stone-400">
                <ItemImg itemId={step.feedItem} nombre={nombre(step.feedItem)} size={16} />
                {nombre(step.feedItem)} (comida) {#if disp(step.feedItem)}<span class="text-stone-600">({fmtDisp(disp(step.feedItem))} disp.)</span>{/if}
              </span>
              <input type="number" bind:value={feedQty} min="0" placeholder={disp(step.feedItem) ? fmtDisp(disp(step.feedItem)) : ''} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
            </label>
          {/if}
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Silver (estación/otros)</span>
            <input type="number" bind:value={silver} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
        </div>
        <p class="mt-2 text-xs text-stone-500">
          El costo de los terneros y la comida sale de cuando los compraste (pasos de arriba); aquí solo se consumen.
        </p>
      {:else}
        <div class="grid grid-cols-3 gap-2">
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">{nombre(step.inputItem)} usado {#if disp(step.inputItem)}<span class="text-stone-600">({fmtDisp(disp(step.inputItem))} disp.)</span>{/if}</span>
            <input type="number" bind:value={inputQty} min="0" placeholder={disp(step.inputItem) ? fmtDisp(disp(step.inputItem)) : ''} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          {#if step.feedItem}
            <label class="block">
              <span class="mb-1 flex items-center gap-1.5 text-xs text-stone-400"><ItemImg itemId={step.feedItem} nombre={nombre(step.feedItem)} size={16} />{nombre(step.feedItem)} usado {#if disp(step.feedItem)}<span class="text-stone-600">({fmtDisp(disp(step.feedItem))} disp.)</span>{/if}</span>
              <input type="number" bind:value={feedQty} min="0" placeholder={disp(step.feedItem) ? fmtDisp(disp(step.feedItem)) : ''} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
            </label>
          {/if}
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">{nombre(step.outputItem)} obtenido</span>
            <input type="number" bind:value={outputQty} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Silver estación</span>
            <input type="number" bind:value={silver} min="0" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
        </div>
      {/if}

      <input type="date" bind:value={fecha} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm" />

      {#if error}
        <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      {/if}

      <button type="submit" disabled={saving} class="w-full rounded-lg bg-amber-500 px-4 py-2 font-medium text-stone-950 transition hover:bg-amber-400 disabled:opacity-60">
        {saving ? 'Guardando…' : 'Registrar'}
      </button>
    </form>
  {/if}
</div>
