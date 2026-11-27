<script lang="ts">
  import { base } from '$app/paths';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import MiniChart from '$lib/components/MiniChart.svelte';

  let { data } = $props();

  const PALETTE = ['#f59e0b', '#3b82f6', '#22c55e', '#ec4899', '#a855f7', '#f97316', '#14b8a6', '#ef4444'];

  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });

  // Nombre con encantamiento (.1/.2/.3) si aplica.
  function nombre(id: string): string {
    const base = data.names[id] ?? id;
    const ench = Number(id.split('@')[1] ?? 0);
    return ench > 0 ? `${base} .${ench}` : base;
  }

  // --- Tablero: por miembro, lo que saca y a cuánto (costo más reciente) ---
  const porMiembro = $derived.by(() => {
    const byUser = new Map<string, Map<string, { item_id: string; cost: number; fecha: string }>>();
    for (const p of data.points) {
      let m = byUser.get(p.user_id);
      if (!m) {
        m = new Map();
        byUser.set(p.user_id, m);
      }
      const cur = m.get(p.item_id);
      if (!cur || p.fecha > cur.fecha) m.set(p.item_id, { item_id: p.item_id, cost: p.cost, fecha: p.fecha });
    }
    return [...byUser.entries()]
      .map(([uid, m]) => ({
        userId: uid,
        nick: data.nicks[uid] ?? '—',
        items: [...m.values()].sort((a, b) => nombre(a.item_id).localeCompare(nombre(b.item_id))),
      }))
      .sort((a, b) => a.nick.localeCompare(b.nick));
  });

  // --- Historial por día de un item ---
  function initItem() {
    return data.items[0]?.item_id ?? '';
  }
  let itemId = $state(initItem());
  const pts = $derived(data.points.filter((p) => p.item_id === itemId));
  const fechas = $derived([...new Set(pts.map((p) => p.fecha))].sort().reverse());
  const miembros = $derived.by(() => {
    const ids = [...new Set(pts.map((p) => p.user_id))];
    const latest = (uid: string) => {
      const ps = pts.filter((p) => p.user_id === uid).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      return ps[0]?.cost ?? Infinity;
    };
    return ids.sort((a, b) => latest(a) - latest(b));
  });
  function costo(uid: string, fecha: string): number | null {
    return pts.find((p) => p.user_id === uid && p.fecha === fecha)?.cost ?? null;
  }

  // Gráfico dinámico: una línea de costo por miembro, sobre el tiempo.
  const fechasAsc = $derived([...fechas].reverse());
  const chartConfig = $derived.by(() => ({
    type: 'line',
    data: {
      labels: fechasAsc,
      datasets: miembros.map((uid, i) => ({
        label: data.nicks[uid] ?? '—',
        data: fechasAsc.map((f) => costo(uid, f)),
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: PALETTE[i % PALETTE.length] + '33',
        spanGaps: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#a8a29e', boxWidth: 10, padding: 12 } } },
      scales: {
        x: { ticks: { color: '#78716c', maxRotation: 0, autoSkip: true }, grid: { color: '#292524' } },
        y: { ticks: { color: '#78716c' }, grid: { color: '#292524' } },
      },
    },
  }));
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Mercado interno</h1>
      <p class="text-sm text-stone-400">Qué saca cada quien y a cuánto (su costo de producción). Todos venden a costo; el seguimiento es entre ustedes.</p>
    </div>
    <a href="{base}/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">🏠 Inicio</a>
  </div>

  {#if data.items.length === 0}
    <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">
      Todavía no hay producción registrada. El mercado interno se arma solo con los costos de la cadena (Producción).
    </p>
  {:else}
    <!-- Tablero por miembro -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each porMiembro as m}
        <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
          <p class="mb-2 font-medium">{m.nick}</p>
          {#if m.items.length === 0}
            <p class="text-xs text-stone-500">—</p>
          {:else}
            <div class="space-y-1.5">
              {#each m.items as it}
                <div class="flex items-center gap-2">
                  <ItemImg itemId={it.item_id} nombre={nombre(it.item_id)} size={24} />
                  <button
                    type="button"
                    onclick={() => (itemId = it.item_id)}
                    class="min-w-0 flex-1 truncate text-left text-sm text-stone-300 hover:text-amber-300"
                    title="Ver historial"
                  >
                    {nombre(it.item_id)}
                  </button>
                  <span class="text-sm font-semibold tabular-nums text-amber-300">{fmt(it.cost)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Historial por día del item elegido -->
    <div>
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Historial por día</h2>
        <div class="ml-auto flex items-center gap-2">
          <ItemImg {itemId} size={18} />
          <select bind:value={itemId} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-1.5 text-sm">
            {#each data.items as it}<option value={it.item_id}>{nombre(it.item_id)}</option>{/each}
          </select>
        </div>
      </div>

      {#if fechasAsc.length > 1}
        <div class="mb-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
          {#key itemId}
            <MiniChart config={chartConfig} height="h-72" />
          {/key}
        </div>
      {/if}

      <div class="overflow-x-auto rounded-2xl border border-stone-800">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-stone-800 text-stone-400">
              <th class="px-4 py-2 text-left font-medium">Fecha</th>
              {#each miembros as uid}
                <th class="px-4 py-2 text-right font-medium">{data.nicks[uid] ?? '—'}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each fechas as f}
              <tr class="border-b border-stone-800/60 last:border-b-0">
                <td class="px-4 py-2 text-stone-400 tabular-nums">{f}</td>
                {#each miembros as uid}
                  {@const c = costo(uid, f)}
                  <td class="px-4 py-2 text-right tabular-nums {c != null ? 'text-stone-200' : 'text-stone-600'}">{c != null ? fmt(c) : '—'}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-stone-500">El costo sale de lo que registras en Producción. Para vender a otra ciudad, usa el módulo <strong>Vender</strong>.</p>
    </div>
  {/if}
</section>
