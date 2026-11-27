<script lang="ts">
  import { base } from '$app/paths';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  const fmt = (n: number) => Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' });

  // Distingue encantamientos (.1/.2/.3) en el nombre.
  function etiqueta(it: { item_id: string; name: string }): string {
    const ench = Number(it.item_id.split('@')[1] ?? 0);
    return ench > 0 ? `${it.name} .${ench}` : it.name;
  }

  function initItem() {
    return data.items[0]?.item_id ?? '';
  }
  let itemId = $state(initItem());

  const pts = $derived(data.points.filter((p) => p.item_id === itemId));
  const fechas = $derived([...new Set(pts.map((p) => p.fecha))].sort().reverse());
  // Miembros que tienen costo de este item, ordenados por su costo más reciente (más barato primero).
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
  function ultimo(uid: string): number | null {
    const ps = pts.filter((p) => p.user_id === uid).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    return ps[0]?.cost ?? null;
  }
</script>

<section class="space-y-5">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Mercado interno</h1>
      <p class="text-sm text-stone-400">Como todos se venden a costo, el "precio" de cada quien es su costo de producción. Aquí ves cómo varía día a día.</p>
    </div>
    <a href="{base}/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">🏠 Inicio</a>
  </div>

  {#if data.items.length === 0}
    <p class="rounded-lg bg-stone-800/50 px-3 py-2 text-sm text-stone-400">
      Todavía no hay producción registrada. El mercado interno se arma solo con los costos de la cadena (Producción).
    </p>
  {:else}
    <label class="block max-w-sm">
      <span class="mb-1 flex items-center gap-2 text-xs text-stone-400">Recurso <ItemImg {itemId} size={18} /></span>
      <select bind:value={itemId} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
        {#each data.items as it}<option value={it.item_id}>{etiqueta(it)}</option>{/each}
      </select>
    </label>

    <!-- Precio actual (a costo) por miembro -->
    <div>
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Precio actual (a costo)</h2>
      <div class="flex flex-wrap gap-2">
        {#each miembros as uid, i}
          <div class="rounded-xl border {i === 0 ? 'border-amber-500/40' : 'border-stone-800'} bg-stone-900/50 px-4 py-2">
            <p class="text-xs text-stone-500">{data.nicks[uid] ?? '—'}{#if i === 0}<span class="ml-1 text-amber-300">· más barato</span>{/if}</p>
            <p class="text-lg font-semibold tabular-nums text-amber-300">{ultimo(uid) != null ? fmt(ultimo(uid)!) : '—'}</p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Historial por día -->
    <div>
      <h2 class="mb-2 text-sm font-medium tracking-wide text-stone-400 uppercase">Historial de costo (por día)</h2>
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
      <p class="mt-2 text-xs text-stone-500">El costo sale solo de lo que registras en Producción. Para vender a otra ciudad, usa el módulo <strong>Vender</strong>.</p>
    </div>
  {/if}
</section>
