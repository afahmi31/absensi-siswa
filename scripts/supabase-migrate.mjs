import { readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { runMigrations } from '../server/database/migrate.mjs'

const projectRef = 'jkiewjlohgmsujcwerpi'
const apiRoles = ['anon', 'authenticated', 'service_role']
const action = process.argv[2]
const suppliedRef = process.argv.find((value) => value.startsWith('--project-ref='))?.slice('--project-ref='.length)
const confirmUp = process.argv.includes('--confirm-up')

function fail(message) {
  throw new Error(message)
}

function migrationUrl() {
  const value = process.env.SUPABASE_MIGRATION_DATABASE_URL
  if (!value) fail('Set the private SUPABASE_MIGRATION_DATABASE_URL for the dedicated migration role.')

  let target
  try { target = new URL(value) } catch { fail('The Supabase migration target is invalid.') }
  const queryEntries = [...target.searchParams.entries()]
  const sslMode = target.searchParams.get('sslmode')?.toLowerCase()
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol)
    || !target.hostname.endsWith('.pooler.supabase.com')
    || target.port !== '5432'
    || target.pathname !== '/postgres'
    || target.username !== `lab002_migrator.${projectRef}`
    || !target.password
    || queryEntries.some(([key]) => key.toLowerCase() !== 'sslmode')
    || (sslMode && !['require', 'verify-full'].includes(sslMode))
  ) {
    fail('Refusing a target that is not the expected project Session pooler and migration role.')
  }
  target.search = ''
  return target
}

async function caCertificate() {
  const inline = process.env.SUPABASE_DATABASE_CA || process.env.NUXT_DATABASE_CA
  if (inline) return inline
  const path = process.env.SUPABASE_CA_CERT_PATH
  if (!path) fail('Set SUPABASE_DATABASE_CA or SUPABASE_CA_CERT_PATH to the project CA certificate.')
  try { return await readFile(path, 'utf8') } catch { fail('The configured CA certificate could not be read.') }
}

async function verifyTarget(database, { verifyPostMigration = false } = {}) {
  const [target] = await database`
    select current_user as role_name,
           current_database() as database_name,
           current_setting('server_version_num')::int as version_num,
           inet_server_port() as server_port,
           has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema,
           has_schema_privilege(current_user, 'public', 'USAGE') as can_use_public,
           has_schema_privilege(current_user, 'public', 'CREATE') as can_create_public
  `

  if (
    target.role_name !== 'lab002_migrator'
    || target.database_name !== 'postgres'
    || Math.floor(Number(target.version_num) / 10000) !== 17
    || Number(target.server_port) !== 5432
  ) {
    fail('Connected database identity, PostgreSQL version, or Session pooler backend port did not match.')
  }

  const [roles] = await database`
    select
      exists (select 1 from pg_roles where rolname = 'lab002_app' and rolcanlogin and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole) as runtime_role_ready,
      ${database.array(apiRoles)}::text[] <@ (select array_agg(rolname) from pg_roles) as api_roles_exist,
      exists (select 1 from pg_roles where rolname = 'lab002_migrator' and rolcanlogin and not rolsuper) as migrator_role_ready
  `

  if (!roles.runtime_role_ready || !roles.api_roles_exist || !roles.migrator_role_ready) {
    fail('The least-privilege runtime, migration, or Supabase API roles are not ready.')
  }

  const [permissions] = await database`
    select
      has_database_privilege(current_user, current_database(), 'CREATE') as database_create,
      has_schema_privilege(current_user, 'public', 'USAGE') as public_usage,
      has_schema_privilege(current_user, 'public', 'CREATE') as public_create,
      exists (
        select 1 from pg_namespace n,
          lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) acl
        where n.nspname = 'public'
          and acl.grantee = (select oid from pg_roles where rolname = current_user)
          and acl.is_grantable
          and acl.privilege_type in ('USAGE', 'CREATE')
        group by n.oid
        having count(distinct acl.privilege_type) = 2
      ) as public_grant_option,
      ${verifyPostMigration}::boolean as verify_post_migration
  `
  if (!permissions.database_create || !permissions.public_usage || !permissions.public_create || !permissions.public_grant_option) {
    fail('Migration role lacks database CREATE and grantable public schema permissions; PM bootstrap is required.')
  }

  if (verifyPostMigration) await verifyAccessPolicy(database)
  return target
}

async function verifyAccessPolicy(database) {
  const expectedTables = [
    'teacher_accounts', 'schools', 'school_classes', 'semesters', 'students',
    'semester_memberships', 'school_calendar_rules', 'calendar_exceptions',
    'attendance_records', 'teacher_sessions', 'semester_archive_snapshots',
    'audit_events', 'schema_migrations',
  ]
  const [result] = await database`
    select
      bool_and(relrowsecurity) filter (where nspname = 'public' and relname = any(${database.array(expectedTables)}::text[])) as public_rls,
      (select reloptions @> array['security_invoker=true']
       from pg_class where oid = 'public.effective_attendance'::regclass) as invoker_view,
      has_table_privilege('lab002_app', 'public.effective_attendance', 'SELECT') as app_view_read,
      has_table_privilege('lab002_app', 'public.audit_events', 'SELECT') as app_audit_read,
      has_table_privilege('lab002_app', 'public.audit_events', 'INSERT') as app_audit_insert,
      has_table_privilege('lab002_app', 'public.schema_migrations', 'SELECT') as app_ledger_read,
      has_function_privilege('lab002_app', 'public.school_local_today(uuid)', 'EXECUTE') as app_calendar_execute,
      has_function_privilege('lab002_app', 'public.append_row_audit_event()', 'EXECUTE') as app_audit_execute,
      NOT EXISTS (
        SELECT 1 FROM pg_roles r
        WHERE r.rolname = ANY(${database.array(apiRoles)}::text[])
          AND (has_schema_privilege(r.oid, 'public', 'USAGE')
            OR has_schema_privilege(r.oid, 'private', 'USAGE')
            OR has_table_privilege(r.oid, 'public.students', 'SELECT')
            OR has_table_privilege(r.oid, 'public.effective_attendance', 'SELECT')
            OR has_table_privilege(r.oid, 'public.audit_events', 'SELECT')
            OR has_table_privilege(r.oid, 'private.login_throttle_attempts', 'SELECT'))
      ) as api_private
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
  `

  if (
    !result.public_rls
    || !result.invoker_view
    || !result.app_view_read
    || !result.app_audit_read
    || result.app_audit_insert
    || result.app_ledger_read
    || !result.app_calendar_execute
    || result.app_audit_execute
    || !result.api_private
  ) {
    fail('Post-migration access verification failed; keep the application offline and have PM review the grants.')
  }
}

try {
  if (!['check', 'up'].includes(action)) fail('Usage: node scripts/supabase-migrate.mjs <check|up> --project-ref=jkiewjlohgmsujcwerpi [--confirm-up]')
  if (suppliedRef !== projectRef) fail('The explicit project-ref argument must match the approved Supabase project.')
  if (action === 'up' && !confirmUp) fail('Migration writes require the explicit --confirm-up flag.')

  const target = migrationUrl()
  const ca = await caCertificate()
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    fail('The configured Supabase CA certificate is invalid.')
  }

  const database = postgres(target.toString(), {
    max: 1,
    connect_timeout: 5,
    prepare: false,
    ssl: { ca, rejectUnauthorized: true, servername: target.hostname },
    connection: { application_name: 'lab002-supabase-migration' },
  })
  try {
    await verifyTarget(database)
    console.log('Supabase target preflight passed: expected project, PG17 Session pooler, verified client TLS, and migration grants.')

    if (action === 'up') {
      const results = await runMigrations(database, 'up')
      for (const result of results) console.log(`${result.applied ? 'Applied' : 'Unchanged'} ${result.name}`)
      await verifyTarget(database, { verifyPostMigration: true })
      console.log('Post-migration access check passed: runtime-only access and RLS are in place.')
    }
  } finally {
    await database.end({ timeout: 3 })
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Supabase migration failed.'
  if (message.startsWith('Usage:') || message.startsWith('Set ') || message.startsWith('The ') || message.startsWith('Refusing ') || message.startsWith('Connected ') || message.startsWith('The least-privilege') || message.startsWith('Migration role') || message.startsWith('Post-migration')) {
    console.error(message)
  } else {
    console.error('Supabase migration failed; connection details and database errors were suppressed.')
  }
  process.exitCode = 1
}
