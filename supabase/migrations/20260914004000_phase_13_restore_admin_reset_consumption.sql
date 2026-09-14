-- Phase 13 corrective migration: restore the Phase-9 atomic password-reset
-- consumption contract that the admin-auth runtime already calls.
--
-- Security invariants:
-- - reset tokens are short-lived and single-use;
-- - plaintext passwords are never persisted;
-- - only the active RC IT Services super-admin may be changed;
-- - successful recovery revokes active administrator sessions;
-- - browser roles cannot execute this RPC.

create or replace function public.consume_admin_password_reset_token(
  p_token_hash text,
  p_new_password text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token_id uuid;
  v_admin_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$'
     or p_new_password is null
     or char_length(p_new_password) < 12
     or char_length(p_new_password) > 256
     or p_new_password !~ '[A-Z]'
     or p_new_password !~ '[a-z]'
     or p_new_password !~ '[0-9]'
     or p_new_password !~ '[^A-Za-z0-9]' then
    return false;
  end if;

  select id, admin_id
  into v_token_id, v_admin_id
  from public.password_reset_tokens
  where token_hash = p_token_hash
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    return false;
  end if;

  update public.admins
  set
    password_hash = extensions.crypt(
      encode(extensions.digest(p_new_password, 'sha256'), 'hex'),
      extensions.gen_salt('bf', 12)
    ),
    updated_at = now()
  where id = v_admin_id
    and status = 'active'
    and role = 'super_admin'
    and lower(email) = 'rcitcservices@gmail.com';

  if not found then
    return false;
  end if;

  update public.password_reset_tokens
  set used_at = coalesce(used_at, now())
  where admin_id = v_admin_id and used_at is null;

  update public.sessions
  set revoked_at = coalesce(revoked_at, now())
  where admin_id = v_admin_id and revoked_at is null;

  return true;
end;
$$;

revoke execute on function public.consume_admin_password_reset_token(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_admin_password_reset_token(text, text)
  to service_role;

comment on function public.consume_admin_password_reset_token(text, text) is
  'Phase 13 restoration of the Phase 9 atomic single-use reset-token consumption, password replacement and session revocation contract.';
