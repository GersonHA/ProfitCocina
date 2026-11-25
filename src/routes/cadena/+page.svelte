<script lang="ts">
  import ItemImg from '$lib/components/ItemImg.svelte';
  import ChainStep from '$lib/components/ChainStep.svelte';

  let { data } = $props();

  function nombre(id: string): string {
    return data.names[id] ?? id;
  }
  function saldo(id: string) {
    return data.balances[id] ?? { qty: 0, avg: 0 };
  }
  function fmt(n: number): string {
    return Math.round(n).toLocaleString('es-ES');
  }
</script>

<section class="space-y-6">
  <h1 class="text-2xl font-semibold">Mi cadena</h1>

  {#if !data.group}
    <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">No tienes un grupo activo.</p>
  {:else if !data.chain}
    <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">
      No tienes una cadena configurada para “{data.produce ?? '—'}”.
      Usa <a href="/registrar/lote" class="underline">el formulario avanzado</a>.
    </p>
  {:else}
    <!-- Cadena dibujada -->
    <div class="flex flex-wrap items-stretch gap-2">
      {#each data.chain.nodes as node, i}
        <div class="flex-1 rounded-xl border border-stone-800 bg-stone-900/50 p-3 text-center">
          <ItemImg itemId={node} nombre={nombre(node)} size={40} />
          <div class="mt-1 text-xs font-medium">{nombre(node)}</div>
          <div class="text-xs text-stone-400 tabular-nums">{fmt(saldo(node).qty)}</div>
          {#if saldo(node).avg > 0}
            <div class="text-[10px] text-amber-400 tabular-nums">@ {fmt(saldo(node).avg)}</div>
          {/if}
        </div>
        {#if i < data.chain.nodes.length - 1}
          <div class="flex items-center text-stone-600">▶</div>
        {/if}
      {/each}
    </div>

    <!-- Pasos -->
    <div class="space-y-2">
      <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Registrar un paso</h2>
      {#each data.chain.steps as step (step.id)}
        <ChainStep {step} groupId={data.group.id} names={data.names} />
      {/each}
    </div>

    <p class="text-center text-xs text-stone-600">
      ¿Un caso raro? Usa el <a href="/registrar/lote" class="underline">formulario avanzado</a>.
    </p>
  {/if}
</section>
