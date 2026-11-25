<script lang="ts">
  import '../app.css';
  import { supabase } from '$lib/supabase';
  import { goto, invalidateAll } from '$app/navigation';

  let { data, children } = $props();

  async function logout() {
    await supabase.auth.signOut();
    await invalidateAll();
    await goto('/login');
  }
</script>

<div class="min-h-screen bg-stone-950 text-stone-100">
  {#if data.session}
    <header
      class="sticky top-0 z-10 flex items-center justify-between border-b border-stone-800 bg-stone-900/80 px-4 py-3 backdrop-blur"
    >
      <a href="/" class="flex items-center gap-2 font-semibold">
        <span class="text-xl">🍲</span>
        <span>Profit Cocina</span>
      </a>
      <div class="flex items-center gap-3 text-sm">
        <span class="hidden text-stone-400 sm:inline">{data.session.user.email}</span>
        <button
          onclick={logout}
          class="rounded-lg border border-stone-700 px-3 py-1.5 text-stone-300 transition hover:bg-stone-800"
        >
          Salir
        </button>
      </div>
    </header>
  {/if}

  <main class="mx-auto w-full max-w-3xl px-4 py-6">
    {@render children()}
  </main>
</div>
