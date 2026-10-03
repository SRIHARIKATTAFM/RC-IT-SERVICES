-- Preserve the existing outbound reply table. Incoming mail is append-only and
-- separately keyed by its RFC Message-ID (or a digest of the raw message).
create table public.contact_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid references public.contact_enquiries(id) on delete set null,
  source_message_id text not null unique check (char_length(source_message_id) between 8 and 512),
  sender_email text not null check (char_length(sender_email) between 3 and 254),
  recipient_email text not null check (lower(recipient_email) = 'contact@rcitcs.com'),
  subject text not null check (char_length(subject) between 1 and 300),
  body_text text not null default '' check (char_length(body_text) <= 10000),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index contact_inbound_messages_enquiry_received_idx
  on public.contact_inbound_messages(enquiry_id, received_at desc, id desc);
alter table public.contact_inbound_messages enable row level security;
alter table public.contact_inbound_messages force row level security;
revoke all on public.contact_inbound_messages from public, anon, authenticated;
grant select, insert on public.contact_inbound_messages to service_role;

-- Both directions share a private file inventory. Storage paths are random and
-- never exposed directly; admin downloads pass through authenticated routes.
create table public.contact_message_attachments (
  id uuid primary key default gen_random_uuid(),
  inbound_message_id uuid references public.contact_inbound_messages(id) on delete cascade,
  outbound_message_id uuid references public.contact_enquiry_messages(id) on delete cascade,
  storage_path text not null unique,
  filename text not null check (char_length(filename) between 1 and 255),
  content_type text not null check (char_length(content_type) between 1 and 150),
  size_bytes integer not null check (size_bytes between 1 and 20971520),
  created_at timestamptz not null default now(),
  constraint contact_attachment_one_direction check
    ((inbound_message_id is not null) <> (outbound_message_id is not null))
);
create index contact_attachment_inbound_idx on public.contact_message_attachments(inbound_message_id);
create index contact_attachment_outbound_idx on public.contact_message_attachments(outbound_message_id);
alter table public.contact_message_attachments enable row level security;
alter table public.contact_message_attachments force row level security;
revoke all on public.contact_message_attachments from public, anon, authenticated;
grant select, insert on public.contact_message_attachments to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('contact-attachments', 'contact-attachments', false, 20971520)
on conflict (id) do nothing;

create or replace function public.ingest_contact_inbound_message(
  p_source_message_id text,
  p_sender_email text,
  p_recipient_email text,
  p_subject text,
  p_body_text text,
  p_received_at timestamptz default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_enquiry_id uuid;
  v_match_count integer;
  v_token text;
  v_sender text := lower(btrim(coalesce(p_sender_email, '')));
  v_subject text := left(btrim(coalesce(p_subject, '')), 300);
begin
  if char_length(coalesce(p_source_message_id, '')) not between 8 and 512
     or char_length(v_sender) not between 3 and 254
     or v_sender !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or lower(btrim(coalesce(p_recipient_email, ''))) <> 'contact@rcitcs.com'
     or v_subject = '' then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  -- New outbound subjects can carry an exact enquiry reference. A forged token
  -- cannot bind to another customer's enquiry because the sender must match.
  v_token := substring(v_subject from '\[RC-ENQ:([0-9a-fA-F-]{36})\]');
  if v_token is not null then
    select id into v_enquiry_id from public.contact_enquiries
    where id::text = lower(v_token) and lower(email) = v_sender;
  end if;

  -- Legacy conversations have no token. Attach only when the sender has exactly
  -- one enquiry; ambiguous messages remain visible for administrative review.
  if v_enquiry_id is null then
    select count(*), (array_agg(id))[1] into v_match_count, v_enquiry_id
    from public.contact_enquiries where lower(email) = v_sender;
    if v_match_count <> 1 then v_enquiry_id := null; end if;
  end if;

  insert into public.contact_inbound_messages (
    enquiry_id, source_message_id, sender_email, recipient_email,
    subject, body_text, received_at
  ) values (
    v_enquiry_id, p_source_message_id, v_sender, 'contact@rcitcs.com',
    v_subject, left(coalesce(p_body_text, ''), 10000),
    coalesce(p_received_at, now())
  ) on conflict (source_message_id) do nothing returning id into v_id;

  if v_id is null then
    select id, enquiry_id into v_id, v_enquiry_id
    from public.contact_inbound_messages where source_message_id = p_source_message_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'message_id', v_id, 'enquiry_id', v_enquiry_id);
  end if;

  if v_enquiry_id is not null then
    update public.contact_enquiries
    set last_activity_at = greatest(last_activity_at, coalesce(p_received_at, now())),
        read_at = null
    where id = v_enquiry_id;

    insert into public.notifications (admin_id, type, title, body)
    select id, 'contact_reply_received', 'Customer replied to contact enquiry',
           left(v_subject, 300)
    from public.admins where status = 'active' and role = 'super_admin';
  end if;

  return jsonb_build_object('ok', true, 'duplicate', false, 'message_id', v_id, 'enquiry_id', v_enquiry_id);
end;
$$;
revoke all on function public.ingest_contact_inbound_message(text,text,text,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.ingest_contact_inbound_message(text,text,text,text,text,timestamptz)
  to service_role;

create or replace function public.get_admin_contact_conversation(
  p_admin_id uuid, p_enquiry_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins where id = p_admin_id and status = 'active' and role = 'super_admin') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  return jsonb_build_object(
    'ok', true,
    'inbound', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'sender_email', sender_email, 'recipient_email', recipient_email,
        'subject', subject, 'body_text', body_text, 'received_at', received_at
      ) order by received_at desc) from (
        select * from public.contact_inbound_messages
        where enquiry_id = p_enquiry_id order by received_at desc limit 200
      ) i
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'inbound_message_id', a.inbound_message_id,
        'outbound_message_id', a.outbound_message_id, 'filename', a.filename,
        'content_type', a.content_type, 'size_bytes', a.size_bytes
      )) from public.contact_message_attachments a
      where a.inbound_message_id in (
        select id from public.contact_inbound_messages where enquiry_id = p_enquiry_id
      ) or a.outbound_message_id in (
        select id from public.contact_enquiry_messages where enquiry_id = p_enquiry_id
      )
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_admin_contact_conversation(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.get_admin_contact_conversation(uuid,uuid) to service_role;

create or replace function public.admin_queue_contact_reply_with_attachments(
  p_admin_id uuid, p_enquiry_id uuid, p_expected_version integer,
  p_subject text, p_body text, p_attachments jsonb default '[]'::jsonb,
  p_ip_hash text default null, p_user_agent text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_attachment jsonb;
  v_path text;
begin
  if jsonb_typeof(p_attachments) <> 'array' or jsonb_array_length(p_attachments) > 5 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;
  v_result := public.admin_queue_contact_enquiry_reply(
    p_admin_id, p_enquiry_id, p_expected_version, p_subject, p_body,
    p_ip_hash, p_user_agent
  );
  if coalesce((v_result->>'ok')::boolean, false) is not true then return v_result; end if;

  for v_attachment in select value from jsonb_array_elements(p_attachments) loop
    v_path := v_attachment->>'storage_path';
    if v_path is null or v_path !~ '^outbound/[0-9a-f-]{36}/[0-4]$'
       or not exists (
         select 1 from storage.objects
         where bucket_id = 'contact-attachments' and name = v_path
       ) then
      raise exception 'contact attachment missing from private storage';
    end if;
    insert into public.contact_message_attachments (
      outbound_message_id, storage_path, filename, content_type, size_bytes
    ) values (
      (v_result->>'message_id')::uuid, v_path,
      left(v_attachment->>'filename', 255),
      left(v_attachment->>'content_type', 150),
      (v_attachment->>'size_bytes')::integer
    );
  end loop;
  return v_result;
end;
$$;
revoke all on function public.admin_queue_contact_reply_with_attachments(uuid,uuid,integer,text,text,jsonb,text,text)
  from public, anon, authenticated;
grant execute on function public.admin_queue_contact_reply_with_attachments(uuid,uuid,integer,text,text,jsonb,text,text)
  to service_role;
