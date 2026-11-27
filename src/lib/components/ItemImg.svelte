<script lang="ts">
  /**
   * Imagen de un item de Albion. Se sirve del CDN oficial
   * (render.albiononline.com), así cualquier item del juego tiene icono sin
   * mantener una lista local. Si el id no existe, cae a un emoji.
   */
  let {
    itemId,
    nombre = '',
    size = 28,
  }: { itemId: string | null | undefined; nombre?: string; size?: number } = $props();

  let failed = $state(false);
  // Reinicia el estado de error al cambiar de item (reintenta la carga).
  $effect(() => {
    itemId;
    failed = false;
  });

  // El '@' de los encantamientos (T8_MEAL_STEW@3) funciona crudo en la URL.
  const src = $derived(itemId ? `https://render.albiononline.com/v1/item/${itemId}.png` : '');
</script>

{#if itemId && !failed}
  <img
    {src}
    alt={nombre || itemId}
    title={nombre || itemId}
    width={size}
    height={size}
    loading="lazy"
    onerror={() => (failed = true)}
    class="inline-block rounded align-middle"
  />
{:else}
  <span class="inline-block align-middle" style="font-size: {size * 0.8}px">📦</span>
{/if}
