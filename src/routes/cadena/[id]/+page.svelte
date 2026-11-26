<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import ChainStep from '$lib/components/ChainStep.svelte';

  let { data } = $props();

  const ESTADO: Record<string, { label: string; clase: string }> = {
    en_curso: { label: 'En curso', clase: 'bg-amber-500/15 text-amber-300' },
    completado: { label: 'Completado', clase: 'bg-green-500/15 text-green-300' },
    cancelado: { label: 'Cancelado', clase: 'bg-stone-700/40 text-stone-400' },
  };

  const run = $derived(data.run);
  const total = $derived(data.steps.length);
  function defDe(stepId: string) {
    return data.chain?.steps.find((s) => s.id === stepId) ?? null;
  }
  function fmt(n: number | null | undefined): string {
    if (n == null) return '';
    return Math.round(Number(n)).toLocaleString('es-ES', { useGrouping: 'always' });
  }

  let busy = $state(false);
  async function cancelar() {
    busy = true;
    try {
      await supabase.from('production_runs').update({ state: 'cancelado' }).eq('id', run.id);
      await invalidateAll();
    } finally {
      busy = false;
    }
  }
</script>

<section class="mx-auto max-w-2xl space-y-5">
  <div class="flex items-center justify-between">
    <a href="/cadena" class="text-sm text-stone-400 hover:text-stone-200">← Producción</a>
    <a href="/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">🏠 Inicio</a>
  </div>

  <div class="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
    <div class="flex-1">
      <h1 class="text-xl font-semibold capitalize">Lote de {run.resource}</h1>
      <p class="text-xs text-stone-500">Paso {Math.min(run.step_index, total)}/{total} · se guarda solo, retómalo cuando quieras</p>
    </div>
    <span class="rounded-full px-2.5 py-1 text-xs {ESTADO[run.state]?.clase}">{ESTADO[run.state]?.label}</span>
    {#if data.isOwner && run.state === 'en_curso'}
      <button onclick={cancelar} disabled={busy} class="rounded-lg border border-stone-700 px-2.5 py-1 text-xs text-stone-400 hover:bg-stone-800">Cancelar</button>
    {/if}
  </div>

  {#if !data.chain}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No se encontró la cadena de este recurso.</p>
  {:else}
    <div class="space-y-2">
      {#each data.steps as rs (rs.id)}
        {@const def = defDe(rs.step_id)}
        {@const esActual = rs.idx === run.step_index && !rs.done && run.state === 'en_curso'}
        {#if rs.done}
          <div class="flex items-center gap-3 rounded-xl border border-green-500/25 bg-stone-900/40 px-4 py-3">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-green-500/20 text-sm text-green-300">✓</span>
            <div class="flex-1">
              <p class="text-sm font-medium">{rs.label}</p>
              {#if rs.qty}<p class="text-xs text-stone-500">{fmt(rs.qty)} und{#if rs.silver}· {fmt(rs.silver)} silver{/if}</p>{/if}
            </div>
          </div>
        {:else if esActual && def}
          <div>
            <p class="mb-1 ml-1 text-xs font-medium text-amber-300">Paso actual</p>
            <ChainStep
              step={def}
              groupId={data.group?.id ?? ''}
              names={data.names}
              runStep={{ id: rs.id, runId: run.id, idx: rs.idx, total }}
              startOpen={true}
            />
          </div>
        {:else}
          <div class="flex items-center gap-3 rounded-xl border border-stone-800 bg-stone-900/30 px-4 py-3 opacity-60">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-stone-800 text-xs text-stone-500">{rs.idx + 1}</span>
            <p class="flex-1 text-sm text-stone-400">{rs.label}</p>
            <span class="text-xs text-stone-600">pendiente</span>
          </div>
        {/if}
      {/each}
    </div>

    {#if run.state === 'completado'}
      <div class="rounded-2xl border border-green-500/25 bg-green-500/5 p-4 text-center">
        <p class="text-sm text-green-300">✓ Lote completado. Lo producido ya está en tu inventario con su costo.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <a href="/" class="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-center font-semibold text-stone-950 hover:bg-amber-400">🏠 Ir al inicio</a>
        <a href="/mi-produccion" class="flex-1 rounded-xl border border-stone-700 px-4 py-2.5 text-center font-medium text-stone-300 hover:bg-stone-800">Ver inventario</a>
      </div>
    {/if}
  {/if}
</section>
