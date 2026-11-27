<script lang="ts">
  import { base } from '$app/paths';
  import { invalidateAll } from '$app/navigation';
  import ItemImg from '$lib/components/ItemImg.svelte';
  import MemberEditor from '$lib/components/MemberEditor.svelte';
  import { createMember } from '$lib/admin';
  import { RESOURCE_GROUPS, resourceNombre } from '$lib/resources';

  let { data } = $props();

  const isAdmin = $derived(data.group?.role === 'admin');

  let email = $state('');
  let nick = $state('');
  let produce = $state('T8_MEAT');
  let password = $state('');
  let creating = $state(false);
  let createError = $state('');
  let created = $state<{ email: string; password: string } | null>(null);

  function genPassword() {
    password = 'cocina' + Math.floor(1000 + Math.random() * 9000);
  }

  async function submitCreate(e: SubmitEvent) {
    e.preventDefault();
    createError = '';
    created = null;
    if (!data.group) return;
    if (!email.trim() || password.length < 6) {
      createError = 'Email y contraseña (mínimo 6 caracteres) son obligatorios.';
      return;
    }
    creating = true;
    try {
      const pass = password;
      const mail = email.trim();
      await createMember({
        groupId: data.group.id,
        email: mail,
        password: pass,
        nick: nick.trim() || mail.split('@')[0],
        produce,
      });
      created = { email: mail, password: pass };
      email = '';
      nick = '';
      password = '';
      await invalidateAll();
    } catch (err) {
      createError = err instanceof Error ? err.message : String(err);
    } finally {
      creating = false;
    }
  }
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Grupo</h1>
    <a href="{base}/" class="rounded-lg border border-stone-700 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800">← Inicio</a>
  </div>
  <div class="flex flex-wrap items-center gap-1.5 text-sm text-stone-400">
    Tú (<span class="text-stone-200">{data.nick ?? data.email}</span>) produces:
    {#if data.produces.length}
      {#each data.produces as pid}
        <span class="inline-flex items-center gap-1 rounded-full bg-stone-800/60 px-2 py-0.5 text-stone-200">
          <ItemImg itemId={pid} nombre={resourceNombre(pid)} size={16} />{resourceNombre(pid)}
        </span>
      {/each}
    {:else}
      <a href="{base}/perfil" class="text-amber-300 underline">elígelo en tu perfil</a>
    {/if}
    <span>· Premium: <span class="text-stone-200">{data.premium ? 'sí' : 'no'}</span></span>
  </div>

  {#if data.roster.length > 0}
    <div class="rounded-2xl border border-stone-800 bg-stone-900/50 p-5">
      <h2 class="mb-3 text-sm font-medium tracking-wide text-stone-400 uppercase">
        Equipo de {data.groupName}
      </h2>
      <ul class="divide-y divide-stone-800">
        {#each data.roster as r}
          {#if isAdmin && data.groupId}
            <MemberEditor member={r} groupId={data.groupId} isSelf={r.userId === data.meId} />
          {:else}
            <li class="flex items-center justify-between py-2.5">
              <span class="flex items-center gap-2.5">
                <span class="flex items-center gap-0.5">
                  {#each r.produces.slice(0, 5) as pid}
                    <ItemImg itemId={pid} nombre={resourceNombre(pid)} size={28} />
                  {/each}
                  {#if r.produces.length === 0}<span class="text-lg">📦</span>{/if}
                </span>
                <span class="font-medium">{r.nick}</span>
                {#if r.role === 'admin'}
                  <span class="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">admin</span>
                {/if}
              </span>
              <span class="hidden text-sm text-stone-400 sm:inline">{r.produces.map(resourceNombre).join(', ') || '—'}</span>
            </li>
          {/if}
        {/each}
      </ul>
    </div>
  {/if}

  {#if isAdmin && data.group}
    <div class="rounded-2xl border border-amber-500/30 bg-stone-900/50 p-5">
      <h2 class="mb-1 text-sm font-medium tracking-wide text-amber-300 uppercase">Crear cuenta de miembro</h2>
      <p class="mb-4 text-xs text-stone-500">Creas la cuenta y le pasas el email y la contraseña a tu amigo.</p>

      <form onsubmit={submitCreate} class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Email</span>
            <input type="email" bind:value={email} placeholder="amigo@cocina.test" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Nick</span>
            <input type="text" bind:value={nick} placeholder="Amigo C" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Recurso principal</span>
            <select bind:value={produce} class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2">
              {#each RESOURCE_GROUPS as g}
                <optgroup label={g.grupo}>
                  {#each g.items as it}<option value={it.id}>{it.nombre}</option>{/each}
                </optgroup>
              {/each}
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs text-stone-400">Contraseña</span>
            <div class="flex gap-2">
              <input type="text" bind:value={password} placeholder="mínimo 6" class="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2" />
              <button type="button" onclick={genPassword} class="rounded-lg border border-stone-700 px-2 text-xs hover:bg-stone-800">generar</button>
            </div>
          </label>
        </div>

        {#if createError}
          <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{createError}</p>
        {/if}

        <button type="submit" disabled={creating} class="w-full rounded-xl bg-amber-500 px-4 py-2.5 font-medium text-stone-950 transition hover:bg-amber-400 disabled:opacity-60">
          {creating ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      {#if created}
        <div class="mt-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-300">
          ✓ Cuenta creada. Pásale estas credenciales:<br />
          Email: <span class="font-mono text-green-200">{created.email}</span><br />
          Contraseña: <span class="font-mono text-green-200">{created.password}</span>
        </div>
      {/if}
    </div>
  {/if}

  <p class="text-center text-xs text-stone-600">
    Los costos y registros de cada miembro son visibles para el grupo: la transparencia es la base del acuerdo.
  </p>
</section>
