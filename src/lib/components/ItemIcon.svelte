<script lang="ts">
  import { base } from '$app/paths';
  import { produceMeta } from '$lib/items';

  let {
    produce,
    size = 28,
  }: { produce: string | null | undefined; size?: number } = $props();

  const meta = $derived(produceMeta(produce));
</script>

{#if meta}
  <img
    src="{base}/items/{meta.id}.png"
    alt={meta.nombre}
    title={meta.nombre}
    width={size}
    height={size}
    loading="lazy"
    class="inline-block rounded align-middle"
  />
{:else}
  <span class="inline-block align-middle" style="font-size: {size * 0.8}px">📦</span>
{/if}
