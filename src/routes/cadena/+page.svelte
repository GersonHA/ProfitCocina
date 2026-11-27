<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { getChain, CHAIN_KEY_BY_ITEM } from '$lib/chains';
  import { resourceNombre } from '$lib/resources';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();
  const ESTADO: Record<string, { label: string; clase: string }> = {
    en_curso: { label: 'En curso', clase: 'bg-amber-500/15 text-amber-300' },
    completado: { label: 'Completado', clase: 'bg-green-500/15 text-green-300' },
    cancelado: { label: 'Cancelado', clase: 'bg-stone-700/40 text-stone-400' },
  };

  function nombre(id: string): string {
    return data.names[id] ?? id;
  }
  function saldo(id: string) {
    return data.balances[id] ?? { qty: 0, avg: 0 };
  }
  function fmt(n: number): string {
    return Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });
  }
  function fecha(s: string): string {
    return s.slice(0, 10);
  }
  function proximoPaso(r: (typeof data.runs)[number]): string {
    return r.steps.find((s) => !s.done)?.label ?? '—';
  }

  function initRecurso() {
    return data.produces[0] ?? '';
  }
  let nuevoRecurso = $state(initRecurso());
  let creando = $state(false);
  let error = $state('');

  async function crearLote() {
    if (!data.group) return;
    const key = CHAIN_KEY_BY_ITEM[nuevoRecurso];
    const chain = key ? getChain(key) : null;
    if (!key || !chain) {
      error = 'Aún no hay una cadena guiada para este recurso (pronto).';
      return;
    }
    creando = true;
    error = '';
    try {
      const { data: run, error: e1 } = await supabase
        .from('production_runs')
        .insert({ group_id: data.group.id, resource: key, state: 'en_curso', step_index: 0 })
        .select('id')
        .single();
      if (e1) throw e1;
      const steps = chain.steps.map((s, i) => ({ run_id: run.id, idx: i, step_id: s.id, label: s.label, kind: s.kind }));
      const { error: e2 } = await supabase.from('run_steps').insert(steps);
      if (e2) throw e2;
      await goto(`${base}/cadena/${run.id}`);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      creando = false;
    }
  }

  const enCurso = $derived(data.runs.filter((r) => r.state === 'en_curso'));
  const terminados = $derived(data.runs.filter((r) => r.state !== 'en_curso'));

  // La cadena mostrada sigue al selector (dinámica, no fija).
  const chainKey = $derived(CHAIN_KEY_BY_ITEM[nuevoRecurso] ?? null);
  const chainSel = $derived(chainKey ? getChain(chainKey) : null);
  const recursoLabel = $derived(nuevoRecurso ? resourceNombre(nuevoRecurso) : '');
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Producción</h1>
      <p class="text-sm text-stone-400">Tus lotes de la cadena, con su estado guardado.</p>
    </div>
    <a href="{base}/mi-produccion" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">Mi inventario</a>
  </div>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else}
    <!-- Crear lote -->
    <div class="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Nuevo lote de</span>
        <select bind:value={nuevoRecurso} disabled={data.produces.length === 0} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm disabled:opacity-50">
          {#if data.produces.length === 0}
            <option value="">—</option>
          {:else}
            {#each data.produces as id}<option value={id}>{resourceNombre(id)}</option>{/each}
          {/if}
        </select>
      </label>
      <button onclick={crearLote} disabled={creando || !chainSel} class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-60">
        {creando ? 'Creando…' : '+ Empezar lote'}
      </button>
      {#if data.produces.length === 0}
        <p class="w-full text-sm text-stone-400">Primero elige qué produces en tu <a href="{base}/perfil" class="text-amber-300 underline">Perfil</a>.</p>
      {/if}
      {#if error}<p class="w-full text-sm text-red-300">{error}</p>{/if}
    </div>

    <!-- Lotes en curso -->
    {#if enCurso.length > 0}
      <div>
        <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">En curso</h2>
        <div class="space-y-2">
          {#each enCurso as r}
            {@const hechos = r.steps.filter((s) => s.done).length}
            <a href="{base}/cadena/{r.id}" class="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-stone-900/50 p-4 transition hover:border-amber-500/50">
              <div class="min-w-0 flex-1">
                <p class="font-medium capitalize">{r.resource}</p>
                <p class="text-xs text-stone-500">{fecha(r.created_at)} · paso {hechos}/{r.steps.length} · <span class="text-amber-300">siguiente: {proximoPaso(r)}</span></p>
              </div>
              <span class="rounded-full px-2.5 py-1 text-xs {ESTADO[r.state]?.clase}">{ESTADO[r.state]?.label}</span>
            </a>
          {/each}
        </div>
      </div>
    {:else}
      <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">No tienes lotes en curso. Empieza uno arriba (ej. comprar semillas) y retómalo cuando coseches, aunque apagues la PC.</p>
    {/if}

    <!-- Diagrama de la cadena (sigue al selector) -->
    {#if chainSel}
      <div>
        <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Cadena de {recursoLabel}</h2>
        <div class="flex flex-wrap items-stretch gap-2">
          {#each chainSel.nodes as node, i}
            <div class="flex-1 rounded-xl border border-stone-800 bg-stone-900/50 p-3 text-center">
              <ItemImg itemId={node} nombre={nombre(node)} size={40} />
              <div class="mt-1 text-xs font-medium">{nombre(node)}</div>
              <div class="text-xs text-stone-400 tabular-nums">{fmt(saldo(node).qty)} und</div>
              {#if saldo(node).avg > 0}<div class="text-[10px] text-amber-400 tabular-nums">a {fmt(saldo(node).avg)} c/u</div>{/if}
            </div>
            {#if i < chainSel.nodes.length - 1}<div class="flex items-center text-stone-600">▶</div>{/if}
          {/each}
        </div>
      </div>
    {:else if nuevoRecurso}
      <div class="rounded-lg bg-stone-800/40 px-3 py-2 text-sm text-stone-400">
        La cadena guiada de <span class="text-stone-200">{recursoLabel}</span> está en construcción. Pronto tendrá sus pasos (semilla/cría → … → producto).
      </div>
    {/if}

    <!-- Lotes terminados -->
    {#if terminados.length > 0}
      <div>
        <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Terminados</h2>
        <div class="space-y-1.5">
          {#each terminados as r}
            <a href="{base}/cadena/{r.id}" class="flex items-center gap-3 rounded-xl border border-stone-800 bg-stone-900/40 px-4 py-2.5 text-sm transition hover:border-stone-700">
              <span class="flex-1 capitalize">{r.resource}</span>
              <span class="text-xs text-stone-500">{fecha(r.created_at)}</span>
              <span class="rounded-full px-2 py-0.5 text-xs {ESTADO[r.state]?.clase}">{ESTADO[r.state]?.label}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</section>
