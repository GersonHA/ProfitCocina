<script lang="ts">
  import { base } from '$app/paths';
  import { supabase } from '$lib/supabase';
  import { goto, invalidateAll } from '$app/navigation';

  let email = $state('gerson@cocina.test');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  function translate(msg: string): string {
    if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
    if (/email not confirmed/i.test(msg)) return 'El email todavía no está confirmado.';
    if (/fetch|network|failed/i.test(msg)) return 'No hay conexión con Supabase. ¿Está levantado el stack local?';
    return msg;
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = '';
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    loading = false;
    if (err) {
      error = translate(err.message);
      return;
    }
    await invalidateAll();
    await goto(`${base}/`);
  }
</script>

<div class="flex min-h-[70vh] items-center justify-center">
  <form
    onsubmit={submit}
    class="w-full max-w-sm space-y-4 rounded-2xl border border-stone-800 bg-stone-900/60 p-6"
  >
    <div class="text-center">
      <div class="text-4xl">🍲</div>
      <h1 class="mt-2 text-xl font-semibold">Profit Cocina</h1>
      <p class="text-sm text-stone-400">Entra con tu cuenta</p>
    </div>

    <label class="block">
      <span class="mb-1 block text-sm text-stone-400">Email</span>
      <input
        type="email"
        bind:value={email}
        autocomplete="username"
        required
        class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 outline-none focus:border-amber-500"
      />
    </label>

    <label class="block">
      <span class="mb-1 block text-sm text-stone-400">Contraseña</span>
      <input
        type="password"
        bind:value={password}
        autocomplete="current-password"
        required
        class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 outline-none focus:border-amber-500"
      />
    </label>

    {#if error}
      <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
    {/if}

    <button
      type="submit"
      disabled={loading}
      class="w-full rounded-lg bg-amber-500 px-4 py-2 font-medium text-stone-950 transition hover:bg-amber-400 disabled:opacity-60"
    >
      {loading ? 'Entrando…' : 'Entrar'}
    </button>
  </form>
</div>
