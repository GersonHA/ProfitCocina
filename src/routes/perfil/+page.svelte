<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import ItemIcon from '$lib/components/ItemIcon.svelte';

  let { data } = $props();

  const PRODUCE_OPTS = ['pan', 'ternera', 'calabaza'];

  // Valores iniciales desde data (envueltos en funciones para no capturar el prop en el init).
  const init = () => data;
  let nick = $state(init().nick);
  let juego = $state(init().juego);
  let gremio = $state(init().gremio);
  let discord = $state(init().discord);
  let produce = $state(init().produce || 'pan');
  let premium = $state(init().premium);
  let notas = $state(init().notas);
  let metaAmount = $state<number | null>(init().metaAmount);
  let metaPeriod = $state<'day' | 'week' | 'month'>(init().metaPeriod);

  let saving = $state(false);
  let msg = $state('');
  let error = $state('');

  async function guardar() {
    error = '';
    msg = '';
    saving = true;
    try {
      const { error: e1 } = await supabase
        .from('profiles')
        .update({
          nick: nick.trim() || null,
          premium,
          especializaciones: {
            produce,
            juego: juego.trim() || undefined,
            gremio: gremio.trim() || undefined,
            discord: discord.trim() || undefined,
            notas: notas.trim() || undefined,
          },
          meta_amount: metaAmount,
          meta_period: metaPeriod,
        })
        .eq('user_id', data.meId);
      if (e1) throw e1;
      msg = 'Perfil guardado.';
      await invalidateAll();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      saving = false;
    }
  }
</script>

<section class="mx-auto max-w-2xl space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Mi perfil</h1>
    <a href="/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">← Panel</a>
  </div>
  <p class="text-sm text-stone-400">Tu correo: <span class="text-stone-200">{data.email}</span></p>

  <!-- Datos del jugador -->
  <div class="space-y-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
    <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Datos del jugador</h2>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Nick (en la app)</span>
        <input type="text" bind:value={nick} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Nombre en el juego</span>
        <input type="text" bind:value={juego} placeholder="tu personaje de Albion" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Gremio</span>
        <input type="text" bind:value={gremio} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs text-stone-400">Discord / contacto</span>
        <input type="text" bind:value={discord} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      </label>
      <label class="block">
        <span class="mb-1 flex items-center gap-1.5 text-xs text-stone-400">Produces <ItemIcon {produce} size={16} /></span>
        <select bind:value={produce} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
          {#each PRODUCE_OPTS as p}<option value={p}>{p}</option>{/each}
        </select>
      </label>
      <label class="flex items-center gap-2 pt-6 text-sm">
        <input type="checkbox" bind:checked={premium} class="size-4" />
        Tengo Premium (afecta el impuesto de venta)
      </label>
    </div>
    <label class="block">
      <span class="mb-1 block text-xs text-stone-400">Notas (opcional)</span>
      <input type="text" bind:value={notas} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
    </label>
  </div>

  <!-- Meta -->
  <div class="space-y-3 rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
    <h2 class="text-sm font-medium tracking-wide text-stone-400 uppercase">Meta de ganancia</h2>
    <p class="text-xs text-stone-500">Tu objetivo de ganancia; el progreso se ve en el Panel.</p>
    <div class="flex gap-2">
      <input type="number" bind:value={metaAmount} min="0" placeholder="silver objetivo" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
      <select bind:value={metaPeriod} class="rounded-lg border border-stone-700 bg-stone-950 px-2 py-2">
        <option value="day">por día</option>
        <option value="week">por semana</option>
        <option value="month">por mes</option>
      </select>
    </div>
  </div>

  {#if msg}<p class="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300">{msg}</p>{/if}
  {#if error}<p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>{/if}

  <button onclick={guardar} disabled={saving} class="w-full rounded-xl bg-amber-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60">
    {saving ? 'Guardando…' : 'Guardar perfil'}
  </button>
</section>
