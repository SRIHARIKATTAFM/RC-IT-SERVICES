import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = await readFile(
  path.join(root, 'supabase/migrations/20260914004000_phase_13_restore_admin_reset_consumption.sql'),
  'utf8'
);
const dbSource = await readFile(path.join(root, 'supabase/functions/admin-auth/db.ts'), 'utf8');
const authSource = await readFile(path.join(root, 'supabase/functions/admin-auth/index.ts'), 'utf8');

assert.match(migration, /create or replace function public\.consume_admin_password_reset_token\(\s*p_token_hash text,\s*p_new_password text\s*\)/s);
assert.match(migration, /returns boolean/);
assert.match(migration, /security invoker/);
assert.match(migration, /set search_path = ''/);
assert.match(migration, /p_token_hash !~ '\^\[0-9a-f\]\{64\}\$'/);
assert.match(migration, /char_length\(p_new_password\) < 12/);
assert.match(migration, /char_length\(p_new_password\) > 256/);
assert.match(migration, /p_new_password !~ '\[A-Z\]'/);
assert.match(migration, /p_new_password !~ '\[a-z\]'/);
assert.match(migration, /p_new_password !~ '\[0-9\]'/);
assert.match(migration, /p_new_password !~ '\[\^A-Za-z0-9\]'/);
assert.match(migration, /from public\.password_reset_tokens[\s\S]*token_hash = p_token_hash[\s\S]*used_at is null[\s\S]*expires_at > now\(\)[\s\S]*for update/);
assert.match(migration, /extensions\.crypt\([\s\S]*extensions\.digest\(p_new_password, 'sha256'\)[\s\S]*extensions\.gen_salt\('bf', 12\)/);
assert.match(migration, /role = 'super_admin'/);
assert.match(migration, /lower\(email\) = 'rcitcservices@gmail\.com'/);
assert.match(migration, /update public\.password_reset_tokens[\s\S]*set used_at = coalesce\(used_at, now\(\)\)[\s\S]*where admin_id = v_admin_id and used_at is null/);
assert.match(migration, /update public\.sessions[\s\S]*set revoked_at = coalesce\(revoked_at, now\(\)\)[\s\S]*where admin_id = v_admin_id and revoked_at is null/);
assert.match(migration, /revoke execute on function public\.consume_admin_password_reset_token\(text, text\)[\s\S]*from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.consume_admin_password_reset_token\(text, text\)[\s\S]*to service_role/);

assert.match(dbSource, /rpc\/consume_admin_password_reset_token/);
assert.match(dbSource, /p_token_hash: tokenHash/);
assert.match(dbSource, /p_new_password: newPassword/);
assert.match(authSource, /consumeResetToken\(await shaHex\(state\.token\), next\)/);
assert.match(authSource, /admin_password_reset_completed/);
assert.match(authSource, /location", `\$\{basePath\}\/\?password=reset`/);
assert.match(authSource, /Password reset completed\. Sign in with the new password\./);

console.log('PASS: admin reset consumption contract remains atomic, single-use and service-role only.');
