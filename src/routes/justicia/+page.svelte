<script lang="ts">
  import { compareModels, MODEL_LABELS, type ModelId } from '$lib/fairness';

  let { data } = $props();

  function defaultSource(): 'real' | 'ejemplo' {
    return data.real?.hasMeals ? 'real' : 'ejemplo';
  }

  let source = $state<'real' | 'ejemplo'>(defaultSource());
  const built = $derived(source === 'real' && data.real ? data.real : data.example);
  const comparison = $derived(compareModels(built.data));

  // "Pozo común" no aplica: cada quien cocina y vende su propio guiso (nada se junta).
  const models = $derived(comparison.models.filter((m) => m.model !== 'pozo_comun'));
  const recommended = $derived(models.find((m) => m.allFair)?.model ?? null);

  let selectedModel = $state<ModelId>('costo');
  const current = $derived(models.find((m) => m.model === selectedModel) ?? models[0]);

  function nombre(id: string): string {
    return built.names[id] ?? id;
  }
  function fmt(n: number): string {
    return Math.round(n).toLocaleString('es-ES');
  }
  function signo(n: number): string {
    return (n >= 0 ? '+' : '') + fmt(n);
  }
</script>

<section class="space-y-5">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Análisis de justicia</h1>
    {#if data.real}
      <div class="flex rounded-lg border border-stone-700 p-0.5 text-xs">
        <button
          onclick={() => (source = 'real')}
          class="rounded px-2.5 py-1 {source === 'real' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'}"
        >Datos reales</button>
        <button
          onclick={() => (source = 'ejemplo')}
          class="rounded px-2.5 py-1 {source === 'ejemplo' ? 'bg-amber-500 text-stone-950' : 'text-stone-400'}"
        >Ejemplo</button>
      </div>
    {/if}
  </div>

  {#if source === 'ejemplo'}
    <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-xs text-stone-400">
      Escenario de ejemplo (Test A): 3 miembros, 1 tanda cada uno, guiso a 750k. Sirve para ver el comparador; cambia a “Datos reales” cuando el grupo registre.
    </p>
  {:else if data.real && data.real.missing.length > 0}
    <div class="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
      Faltan datos para un análisis completo:
      <ul class="mt-1 list-disc pl-4">
        {#each data.real.missing.slice(0, 5) as m}<li>{m}</li>{/each}
      </ul>
    </div>
  {/if}

  <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-xs text-stone-400">
    Cada miembro produce su recurso, compra lo que le falta y vende su platillo por su cuenta. Este análisis mide solo si el <span class="text-stone-200">intercambio de ingredientes</span> es justo; las ventas del platillo son de cada quien.
  </p>

  <!-- Recomendación -->
  <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
    {#if recommended}
      <p class="text-sm">
        Modelo recomendado:
        <span class="font-semibold text-amber-300">{MODEL_LABELS[recommended]}</span>
        <span class="text-stone-400">— el más simple que deja a todos con ✅.</span>
      </p>
    {:else}
      <p class="text-sm text-stone-400">Ningún modelo deja a todos con ✅ con estos datos.</p>
    {/if}
  </div>

  <!-- Selector de modelos -->
  <div class="flex flex-wrap gap-2">
    {#each models as m}
      <button
        onclick={() => (selectedModel = m.model)}
        class="rounded-lg border px-3 py-1.5 text-sm transition {selectedModel === m.model
          ? 'border-amber-500 bg-amber-500/15 text-amber-200'
          : 'border-stone-700 text-stone-400 hover:bg-stone-800'}"
      >
        {m.label}
        <span class="ml-1">{m.allFair ? '✅' : '❌'}</span>
      </button>
    {/each}
  </div>

  <!-- Tabla del modelo seleccionado -->
  {#if current}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="font-medium">{current.label}</h2>
        {#if current.pct !== undefined}
          <span class="text-xs text-stone-400">% sugerido: <span class="text-amber-300">{Math.round(current.pct * 100)}%</span></span>
        {/if}
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-xs text-stone-500">
            <tr>
              <th class="pb-2">Miembro</th>
              <th class="pb-2 text-right">Con acuerdo</th>
              <th class="pb-2 text-right">Vendiendo solo</th>
              <th class="pb-2 text-right">Prueba</th>
              {#if current.model !== 'pozo_comun'}
                <th class="pb-2 text-right">Saldo favores</th>
              {/if}
              <th class="pb-2 text-right">ROI</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-800">
            {#each current.members as m}
              <tr>
                <td class="py-2 font-medium">{nombre(m.memberId)}</td>
                <td class="py-2 text-right tabular-nums">{fmt(m.dealProfit)}</td>
                <td class="py-2 text-right tabular-nums text-stone-400">{fmt(m.soloProfit)}</td>
                <td class="py-2 text-right tabular-nums {m.fair ? 'text-green-300' : 'text-red-300'}">
                  {m.fair ? '✅' : '❌'} {signo(m.diff)}
                </td>
                {#if current.model !== 'pozo_comun'}
                  <td class="py-2 text-right tabular-nums {m.favorBalance >= 0 ? 'text-stone-300' : 'text-amber-300'}">{signo(m.favorBalance)}</td>
                {/if}
                <td class="py-2 text-right tabular-nums text-stone-400">{(m.roi * 100).toFixed(0)}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if current.alert}
        <p class="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">⚠️ {current.alert}</p>
      {/if}

      {#if current.settlements && current.settlements.length > 0}
        <div class="mt-3 rounded-lg bg-stone-800/40 px-3 py-2 text-sm">
          <p class="mb-1 text-xs text-stone-500">Liquidación del saldo de favores:</p>
          <ul class="space-y-0.5">
            {#each current.settlements as s}
              <li><span class="text-stone-300">{nombre(s.from)}</span> le paga <span class="text-amber-300 tabular-nums">{fmt(s.amount)}</span> a <span class="text-stone-300">{nombre(s.to)}</span></li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}

  <p class="text-center text-xs text-stone-600">
    “Con acuerdo” vs “vendiendo solo”: el acuerdo es justo para alguien si gana al menos lo mismo que vendiendo su recurso por su cuenta.
  </p>
</section>
