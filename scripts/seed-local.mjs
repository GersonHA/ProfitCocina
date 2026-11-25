/**
 * Crea usuarios de prueba en el Supabase LOCAL (nunca producción).
 *
 * Usa la Admin API de Auth con la service_role key local (clave de demostración
 * del CLI, pública y solo válida en local). Es idempotente: si el usuario ya
 * existe, lo deja como está.
 *
 * Uso:
 *   npm run db:start          # el stack debe estar arriba
 *   node scripts/seed-local.mjs
 *   # luego, para nicks + grupo de prueba:
 *   docker exec -i supabase_db_ProfitCocina psql -U postgres -d postgres -f - < supabase/tests/seed_group.sql
 *
 * Variables de entorno opcionales para apuntar a otro stack:
 *   SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const API = process.env.SUPABASE_API_URL || 'http://127.0.0.1:54321';
// Clave service_role de demostración del CLI de Supabase (solo local).
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const PASSWORD = 'cocina1234';

const USERS = [
  { email: 'gerson@cocina.test', nick: 'Gerson', produce: 'pan' },
  { email: 'amigoa@cocina.test', nick: 'Amigo A', produce: 'ternera' },
  { email: 'amigob@cocina.test', nick: 'Amigo B', produce: 'calabaza' },
];

/** Crea un usuario confirmado. Devuelve true si lo creó, false si ya existía. */
async function createUser(u) {
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
    },
    body: JSON.stringify({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nick: u.nick, produce: u.produce },
    }),
  });

  if (res.ok) return true;

  const body = await res.json().catch(() => ({}));
  const msg = JSON.stringify(body);
  if (res.status === 422 || /already been registered|already exists/i.test(msg)) {
    return false; // ya existía
  }
  throw new Error(`No se pudo crear ${u.email}: ${res.status} ${msg}`);
}

async function main() {
  console.log(`Creando usuarios de prueba en ${API} …`);
  for (const u of USERS) {
    const creado = await createUser(u);
    console.log(`  ${creado ? '✓ creado ' : '· ya existía'}  ${u.email}  (${u.nick} — ${u.produce})`);
  }
  console.log(`\nContraseña de todos: ${PASSWORD}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
