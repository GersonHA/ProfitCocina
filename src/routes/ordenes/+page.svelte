<script lang="ts">
  import { base } from '$app/paths';
  import ItemImg from '$lib/components/ItemImg.svelte';

  let { data } = $props();

  const ESTADO: Record<string, { label: string; clase: string }> = {
    compras: { label: 'En compras', clase: 'bg-sky-500/15 text-sky-300' },
    cocina: { label: 'En cocina', clase: 'bg-amber-500/15 text-amber-300' },
    completado: { label: 'Completado', clase: 'bg-green-500/15 text-green-300' },
    cancelado: { label: 'Cancelado', clase: 'bg-stone-700/40 text-stone-400' },
    plan: { label: 'Plan', clase: 'bg-stone-700/40 text-stone-400' },
  };

  function baseDe(id: string): string {
    return id.split('@')[0];
  }
  function calidad(id: string): string {
    const [base, e] = id.split('@');
    if (!e) return '';
    const t = base.match(/^T(\d)_/);
    return `${t ? t[1] : ''}.${e}`;
  }
  function nombre(id: string): string {
    return data.names[baseDe(id)] ?? id;
  }
  function fecha(s: string): string {
    return s.slice(0, 10);
  }
</script>

<section class="space-y-5">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Órdenes de producción</h1>
    <a href="{base}/tienda" class="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-stone-950 hover:bg-amber-400">+ Nueva (desde Tienda)</a>
  </div>
  <p class="text-sm text-stone-400">
    Cada orden sigue el flujo <span class="text-sky-300">compras</span> → <span class="text-amber-300">cocina</span> → <span class="text-green-300">completado</span>, registrando cada movimiento.
  </p>

  {#if data.orders.length === 0}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-8 text-center">
      <p class="text-sm text-stone-400">Aún no tienes órdenes.</p>
      <a href="{base}/tienda" class="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-400">Crear una desde la Tienda</a>
    </div>
  {:else}
    <div class="space-y-2">
      {#each data.orders as o}
        <a href="{base}/ordenes/{o.id}" class="flex items-center gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-4 transition hover:border-amber-500/40">
          <ItemImg itemId={o.output_item} nombre={nombre(o.output_item)} size={36} />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">
              {o.tandas}× {nombre(o.output_item)}
              {#if calidad(o.output_item)}<span class="text-amber-300">{calidad(o.output_item)}</span>{/if}
            </p>
            <p class="text-xs text-stone-500">{fecha(o.created_at)} · {o.comprados}/{o.total} ingredientes comprados</p>
          </div>
          <span class="rounded-full px-2.5 py-1 text-xs {ESTADO[o.state]?.clase ?? ''}">{ESTADO[o.state]?.label ?? o.state}</span>
        </a>
      {/each}
    </div>
  {/if}
</section>
