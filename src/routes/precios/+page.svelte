<script lang="ts">
  import { base } from '$app/paths';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import MiniChart from '$lib/components/MiniChart.svelte';

  let { data } = $props();

  const PALETTE = [
    '#f59e0b', '#3b82f6', '#22c55e', '#ec4899', '#a855f7', '#f97316',
    '#14b8a6', '#ef4444', '#eab308', '#6366f1', '#06b6d4', '#84cc16',
  ];

  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });

  function nombre(id: string): string {
    const b = data.names[id] ?? id;
    const ench = Number(id.split('@')[1] ?? 0);
    return ench > 0 ? `${b} .${ench}` : b;
  }

  // Miembros presentes (con algún dato).
  const miembros = $derived(
    [...new Set(data.points.map((p) => p.user_id))]
      .map((uid) => ({ uid, nick: data.nicks[uid] ?? '—' }))
      .sort((a, b) => a.nick.localeCompare(b.nick)),
  );

  // Filtros.
  let fUser = $state(''); // '' = todos
  let fItem = $state(''); // '' = todos

  const visibles = $derived(
    data.points.filter((p) => (fUser === '' || p.user_id === fUser) && (fItem === '' || p.item_id === fItem)),
  );

  // Combinaciones (miembro × recurso) visibles = cada una es una línea.
  const combos = $derived.by(() => {
    const seen = new Set<string>();
    const out: { user_id: string; item_id: string }[] = [];
    for (const p of visibles) {
      const k = `${p.user_id}|${p.item_id}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ user_id: p.user_id, item_id: p.item_id });
      }
    }
    return out.sort(
      (a, b) =>
        (data.nicks[a.user_id] ?? '').localeCompare(data.nicks[b.user_id] ?? '') ||
        nombre(a.item_id).localeCompare(nombre(b.item_id)),
    );
  });

  function latest(user_id: string, item_id: string) {
    const ps = data.points
      .filter((p) => p.user_id === user_id && p.item_id === item_id)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    return ps[0] ?? null;
  }

  // --- Gráfico dinámico ---
  const fechas = $derived([...new Set(visibles.map((p) => p.fecha))].sort());
  function costoEn(user_id: string, item_id: string, fecha: string): number | null {
    return visibles.find((p) => p.user_id === user_id && p.item_id === item_id && p.fecha === fecha)?.cost ?? null;
  }
  function comboLabel(c: { user_id: string; item_id: string }): string {
    const nick = data.nicks[c.user_id] ?? '—';
    const itn = nombre(c.item_id);
    if (fItem && !fUser) return nick; // un recurso -> por miembro
    if (fUser && !fItem) return itn; // un miembro -> por recurso
    return `${nick} · ${itn}`;
  }
  const chartConfig = $derived.by(() => ({
    type: 'line',
    data: {
      labels: fechas,
      datasets: combos.map((c, i) => ({
        label: comboLabel(c),
        data: fechas.map((f) => costoEn(c.user_id, c.item_id, f)),
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: PALETTE[i % PALETTE.length] + '22',
        spanGaps: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: { legend: { labels: { color: '#a8a29e', boxWidth: 10, padding: 10, font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#78716c', maxRotation: 0, autoSkip: true }, grid: { color: '#292524' } },
        y: { ticks: { color: '#78716c' }, grid: { color: '#292524' } },
      },
    },
  }));

  // Clave para forzar recreación del gráfico al cambiar filtros.
  const chartKey = $derived(`${fUser}|${fItem}|${combos.length}`);
</script>

<section class="space-y-5">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Mercado interno</h1>
      <p class="text-sm text-stone-400">Qué saca cada quien, cuánto y a qué costo. Todos venden a costo; esto es el seguimiento entre ustedes.</p>
    </div>
    <a href="{base}/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">🏠 Inicio</a>
  </div>

  {#if data.points.length === 0}
    <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">
      Todavía no hay producción registrada. El mercado interno se arma solo con los costos de la cadena (Producción).
    </p>
  {:else}
    <!-- Filtros -->
    <div class="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Miembro</span>
        <select bind:value={fUser} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
          <option value="">Todos</option>
          {#each miembros as m}<option value={m.uid}>{m.nick}</option>{/each}
        </select>
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Recurso</span>
        <select bind:value={fItem} class="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm">
          <option value="">Todos</option>
          {#each data.items as it}<option value={it.item_id}>{nombre(it.item_id)}</option>{/each}
        </select>
      </label>
      {#if fUser || fItem}
        <button onclick={() => { fUser = ''; fItem = ''; }} class="rounded-lg border border-stone-700 px-3 py-2 text-xs text-stone-300 hover:bg-stone-800">Limpiar</button>
      {/if}
    </div>

    <!-- Gráfico dinámico -->
    {#if fechas.length > 1 && combos.length > 0}
      <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-4">
        <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Evolución del costo</h2>
        {#key chartKey}
          <MiniChart config={chartConfig} height="h-80" />
        {/key}
      </div>
    {/if}

    <!-- Vista general (actual): miembro, recurso, cantidad y costo -->
    <div>
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Vista general (actual)</h2>
      <div class="overflow-x-auto rounded-2xl border border-stone-800">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-stone-800 text-stone-400">
              <th class="px-4 py-2 text-left font-medium">Miembro</th>
              <th class="px-4 py-2 text-left font-medium">Recurso</th>
              <th class="px-4 py-2 text-right font-medium">Cantidad</th>
              <th class="px-4 py-2 text-right font-medium">Costo c/u</th>
            </tr>
          </thead>
          <tbody>
            {#each combos as c}
              {@const l = latest(c.user_id, c.item_id)}
              <tr class="border-b border-stone-800/60 last:border-b-0">
                <td class="px-4 py-2">{data.nicks[c.user_id] ?? '—'}</td>
                <td class="px-4 py-2">
                  <span class="flex items-center gap-2">
                    <ItemImg itemId={c.item_id} nombre={nombre(c.item_id)} size={20} />{nombre(c.item_id)}
                  </span>
                </td>
                <td class="px-4 py-2 text-right tabular-nums text-stone-300">{l ? fmt(l.qty) : '—'}</td>
                <td class="px-4 py-2 text-right font-semibold tabular-nums text-amber-300">{l ? fmt(l.cost) : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-stone-500">La "cantidad" es tu stock actual del recurso; el "costo c/u" es su costo de producción (tu precio interno). Para vender a otra ciudad, usa <strong>Vender</strong>.</p>
    </div>
  {/if}
</section>
