-- Phase 12 — streamlined vacancy authoring without weakening server authority.
-- Adds the requested controlled categories and makes the publication gate match
-- the candidate-facing fields required by the simplified Create job workflow.

insert into public.job_categories (slug, name, is_active, display_order, updated_at)
values
  ('software-development', 'Software Development', true, 180, now()),
  ('data-engineering', 'Data Engineering', true, 190, now()),
  ('full-stack-development', 'Full Stack Development', true, 200, now()),
  ('devops', 'DevOps', true, 210, now()),
  ('network-engineering', 'Network Engineering', true, 220, now()),
  ('frontend-engineering', 'Frontend Engineering', true, 230, now()),
  ('backend-engineering', 'Backend Engineering', true, 240, now()),
  ('generative-ai-gen-ai', 'Generative AI (Gen AI)', true, 250, now())
on conflict (slug) do update
set name = excluded.name,
    is_active = true,
    display_order = excluded.display_order,
    updated_at = now();

create or replace function public.admin_transition_job(
  p_admin_id uuid,
  p_job_id uuid,
  p_expected_version integer,
  p_action text,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_action text := lower(btrim(coalesce(p_action, '')));
begin
  if not exists (
    select 1 from public.admins a
    where a.id = p_admin_id and a.status = 'active' and a.role = 'super_admin'
  ) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Job was not found.');
  end if;
  if p_expected_version is null or p_expected_version <> v_job.version then
    return jsonb_build_object('ok', false, 'code', 'STALE_VERSION', 'message', 'This job changed after the page was loaded. Reload before continuing.');
  end if;
  v_before := to_jsonb(v_job);

  if v_action = 'publish' then
    if v_job.status <> 'draft' then
      return jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Only a draft job can be published.');
    end if;
    if v_job.code is null
       or v_job.category_id is null
       or coalesce(btrim(v_job.description), '') = ''
       or coalesce(btrim(v_job.location), '') = ''
       or v_job.workplace_type is null
       or coalesce(btrim(v_job.experience), '') = ''
       or jsonb_typeof(v_job.required_skills) <> 'array'
       or jsonb_array_length(v_job.required_skills) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'PUBLISH_VALIDATION',
        'message', 'Complete department, job description, location, work mode, experience and required skills before publishing.'
      );
    end if;
    if v_job.closes_at is not null and v_job.closes_at <= now() then
      return jsonb_build_object('ok', false, 'code', 'PUBLISH_VALIDATION', 'message', 'End date must not already have passed.');
    end if;
    update public.jobs j
      set status = 'published',
          published_at = coalesce(j.published_at, now()),
          opens_at = coalesce(j.opens_at, now()),
          archived_at = null,
          updated_by = p_admin_id,
          version = j.version + 1
      where j.id = p_job_id
      returning to_jsonb(j.*) into v_after;
  elsif v_action = 'unpublish' then
    if v_job.status <> 'published' then
      return jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Only a published job can be unpublished.');
    end if;
    update public.jobs j
      set status = 'draft', updated_by = p_admin_id, version = j.version + 1
      where j.id = p_job_id returning to_jsonb(j.*) into v_after;
  elsif v_action = 'close' then
    if v_job.status <> 'published' then
      return jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Only a published job can be closed.');
    end if;
    update public.jobs j
      set status = 'closed', updated_by = p_admin_id, version = j.version + 1
      where j.id = p_job_id returning to_jsonb(j.*) into v_after;
  elsif v_action = 'archive' then
    if v_job.status not in ('draft','closed') then
      return jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Only a draft or closed job can be archived.');
    end if;
    update public.jobs j
      set status = 'archived', archived_at = now(), updated_by = p_admin_id, version = j.version + 1
      where j.id = p_job_id returning to_jsonb(j.*) into v_after;
  elsif v_action = 'restore' then
    if v_job.status <> 'archived' then
      return jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Only an archived job can be restored.');
    end if;
    update public.jobs j
      set status = 'draft', archived_at = null, updated_by = p_admin_id, version = j.version + 1
      where j.id = p_job_id returning to_jsonb(j.*) into v_after;
  else
    return jsonb_build_object('ok', false, 'code', 'INVALID_TRANSITION', 'message', 'Requested job transition is not supported.');
  end if;

  insert into public.audit_logs (
    admin_id, action, entity_type, entity_id, ip_hash, user_agent,
    before_data, after_data, metadata
  ) values (
    p_admin_id, 'job_' || v_action, 'job', p_job_id, p_ip_hash, p_user_agent,
    v_before, v_after, jsonb_build_object('source', 'phase_12_streamlined_job_authoring')
  );

  return jsonb_build_object('ok', true, 'job', v_after);
end;
$$;

revoke all on function public.admin_transition_job(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_transition_job(uuid, uuid, integer, text, text, text) to service_role;
