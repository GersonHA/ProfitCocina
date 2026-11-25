<script lang="ts">
  import { base } from '$app/paths';

  let {
    itemId,
    nombre = '',
    size = 28,
  }: { itemId: string | null | undefined; nombre?: string; size?: number } = $props();
</script>

{#if itemId}
  <img
    src="{base}/items/{itemId}.png"
    alt={nombre || itemId}
    title={nombre || itemId}
    width={size}
    height={size}
    loading="lazy"
    class="inline-block rounded align-middle"
  />
{:else}
  <span class="inline-block align-middle" style="font-size: {size * 0.8}px">📦</span>
{/if}
