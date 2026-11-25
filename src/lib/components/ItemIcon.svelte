<script lang="ts">
  import { produceMeta } from '$lib/items';
  import ItemImg from './ItemImg.svelte';

  let {
    produce,
    size = 28,
  }: { produce: string | null | undefined; size?: number } = $props();

  const meta = $derived(produceMeta(produce));
</script>

<ItemImg itemId={meta?.id} nombre={meta?.nombre} {size} />
