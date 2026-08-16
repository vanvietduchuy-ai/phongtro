-- Huy Rooms v4.7.0 - Supabase primary store + Realtime invalidation
-- Chay toan bo file nay trong Supabase SQL Editor bang vai tro postgres.

begin;

create schema if not exists huy_private;

create table if not exists huy_private.records (
  collection text not null,
  record_id text not null,
  data jsonb not null,
  updated_at_ms bigint not null,
  deleted boolean not null default false,
  property_id text not null default '',
  tenant_id text not null default '',
  primary key (collection, record_id)
);

create index if not exists huy_records_delta_idx
  on huy_private.records (updated_at_ms, collection);
create index if not exists huy_records_property_idx
  on huy_private.records (property_id, collection) where not deleted;
create index if not exists huy_records_tenant_idx
  on huy_private.records (tenant_id, collection) where not deleted;

create table if not exists huy_private.clock (
  id text primary key check (id = 'app'),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into huy_private.clock(id, revision) values ('app', 0)
on conflict (id) do nothing;

create table if not exists huy_private.auth_state (
  id text primary key check (id = 'app'),
  version bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into huy_private.auth_state(id) values ('app') on conflict (id) do nothing;

create table if not exists huy_private.audit_log (
  id bigint generated always as identity primary key,
  revision bigint not null,
  at timestamptz not null default now(),
  actor jsonb not null default '{}'::jsonb,
  action text not null,
  collection text not null,
  record_id text not null,
  before_data jsonb,
  after_data jsonb,
  note text not null default ''
);
create index if not exists huy_audit_revision_idx
  on huy_private.audit_log (revision desc);

-- Bang duy nhat ma trinh duyet duoc doc truc tiep. No chi mang revision,
-- khong mang ten collection, id ban ghi hay du lieu nghiep vu.
create table if not exists public.huy_sync_signals (
  id text primary key check (id = 'app'),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.huy_sync_signals(id, revision) values ('app', 0)
on conflict (id) do nothing;

-- Anh cong khai va ho so private cung nam tren Supabase Storage. Trinh duyet
-- khong duoc ghi truc tiep; API Vercel ghi bang secret key.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('huy-public', 'huy-public', true, 3145728,
    array['image/jpeg','image/png','image/webp']),
  ('huy-private', 'huy-private', false, 3145728,
    array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.huy_sync_signals enable row level security;
alter table huy_private.records enable row level security;
alter table huy_private.clock enable row level security;
alter table huy_private.auth_state enable row level security;
alter table huy_private.audit_log enable row level security;
revoke all on table public.huy_sync_signals from public, anon, authenticated;
grant select on table public.huy_sync_signals to anon, authenticated, service_role;
drop policy if exists "huy signal is public" on public.huy_sync_signals;
create policy "huy signal is public"
  on public.huy_sync_signals for select to anon, authenticated
  using (id = 'app');

drop policy if exists "huy public media read" on storage.objects;
create policy "huy public media read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'huy-public');

-- Khong de Data API truy cap truc tiep schema noi bo.
revoke all on schema huy_private from public, anon, authenticated;
revoke all on all tables in schema huy_private from public, anon, authenticated;
grant usage on schema huy_private to service_role;
grant all on all tables in schema huy_private to service_role;
grant usage, select on all sequences in schema huy_private to service_role;

create or replace function public.huy_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, huy_private
as $$
declare
  v_revision bigint;
  v_data jsonb;
begin
  select revision into v_revision from huy_private.clock where id = 'app';
  select coalesce(jsonb_object_agg(collection, rows), '{}'::jsonb)
    into v_data
  from (
    select collection,
      jsonb_agg(data order by record_id) as rows
    from huy_private.records
    where not deleted
    group by collection
  ) grouped;
  return jsonb_build_object('revision', coalesce(v_revision, 0), 'data', coalesce(v_data, '{}'::jsonb));
end;
$$;

create or replace function public.huy_pull(
  p_since bigint,
  p_collections text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, huy_private
as $$
declare
  v_revision bigint;
  v_changes jsonb;
begin
  select revision into v_revision from huy_private.clock where id = 'app';
  select coalesce(jsonb_object_agg(collection, rows), '{}'::jsonb)
    into v_changes
  from (
    select collection,
      jsonb_agg(data order by updated_at_ms, record_id) as rows
    from huy_private.records
    where updated_at_ms > greatest(coalesce(p_since, 0), 0)
      and collection = any(p_collections)
    group by collection
  ) grouped;
  return jsonb_build_object(
    'serverTime', coalesce(v_revision, 0),
    'changes', coalesce(v_changes, '{}'::jsonb)
  );
end;
$$;

create or replace function public.huy_commit_batch(
  p_expected_revision bigint,
  p_changes jsonb,
  p_actor jsonb default '{}'::jsonb,
  p_audit jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, huy_private
as $$
declare
  v_current bigint;
  v_revision bigint;
  v_collection text;
  v_list jsonb;
  v_rec jsonb;
  v_id text;
  v_deleted boolean;
  v_before jsonb;
  v_property text;
  v_tenant text;
  v_audit jsonb;
  v_reversal_mark boolean;
begin
  select revision into v_current
  from huy_private.clock where id = 'app' for update;

  if coalesce(p_expected_revision, -1) <> v_current then
    return jsonb_build_object('ok', false, 'code', 'stale_global', 'serverTime', v_current);
  end if;

  if p_changes is null or p_changes = '{}'::jsonb then
    return jsonb_build_object('ok', true, 'serverTime', v_current, 'written', 0);
  end if;

  v_revision := greatest(
    (extract(epoch from clock_timestamp()) * 1000)::bigint,
    v_current + 1
  );

  for v_collection, v_list in select key, value from jsonb_each(p_changes)
  loop
    if jsonb_typeof(v_list) <> 'array' then
      raise exception 'Collection % must be an array', v_collection;
    end if;
    for v_rec in select value from jsonb_array_elements(v_list)
    loop
      v_id := nullif(v_rec->>'id', '');
      if v_id is null or length(v_id) > 160 then
        raise exception 'Invalid record id in collection %', v_collection;
      end if;
      v_deleted := coalesce((v_rec->>'deleted')::boolean, false);

      select data into v_before from huy_private.records
      where collection = v_collection and record_id = v_id;

      -- Hai so tai chinh chi duoc phep them but toan moi. Dao giao dich phai la
      -- mot record kind/type moi, khong duoc sua/xoa record da ton tai.
      if v_before is not null and v_collection in ('payments', 'depositLedger') then
        v_reversal_mark := false;
        if v_collection = 'payments'
          and coalesce(v_before->>'reversedAt', '') = ''
          and coalesce(v_rec->>'reversedAt', '') <> ''
          and coalesce(v_before->>'kind', '') = coalesce(v_rec->>'kind', '')
          and coalesce((v_before->>'amount')::numeric, 0) = coalesce((v_rec->>'amount')::numeric, 0)
          and (v_before - 'updatedAt' - 'deleted' - 'reversedAt' - 'reversalReason') =
              (v_rec - 'updatedAt' - 'deleted' - 'baseUpdatedAt' - 'reversedAt' - 'reversalReason')
        then
          v_reversal_mark := true;
        end if;
        if v_deleted or (
          (v_before - 'updatedAt' - 'deleted') is distinct from
          (v_rec - 'updatedAt' - 'deleted' - 'baseUpdatedAt')
          and not v_reversal_mark
        ) then
          raise exception 'IMMUTABLE_LEDGER:%:%', v_collection, v_id;
        end if;
      end if;

      v_rec := (v_rec - 'baseUpdatedAt') || jsonb_build_object(
        'id', v_id,
        'updatedAt', v_revision,
        'deleted', v_deleted
      );
      v_property := coalesce(v_rec->>'propertyId', '');
      v_tenant := coalesce(v_rec->>'tenantId', v_rec->>'primaryTenantId', '');

      insert into huy_private.records(
        collection, record_id, data, updated_at_ms, deleted, property_id, tenant_id
      ) values (
        v_collection, v_id, v_rec, v_revision, v_deleted, v_property, v_tenant
      )
      on conflict (collection, record_id) do update set
        data = excluded.data,
        updated_at_ms = excluded.updated_at_ms,
        deleted = excluded.deleted,
        property_id = excluded.property_id,
        tenant_id = excluded.tenant_id;
    end loop;
  end loop;

  for v_audit in select value from jsonb_array_elements(coalesce(p_audit, '[]'::jsonb))
  loop
    insert into huy_private.audit_log(
      revision, actor, action, collection, record_id, before_data, after_data, note
    ) values (
      v_revision,
      coalesce(p_actor, '{}'::jsonb),
      coalesce(v_audit->>'action', 'update'),
      coalesce(v_audit->>'collection', ''),
      coalesce(v_audit->>'recordId', ''),
      v_audit->'before',
      v_audit->'after',
      left(coalesce(v_audit->>'note', ''), 1000)
    );
  end loop;

  update huy_private.clock
    set revision = v_revision, updated_at = clock_timestamp()
    where id = 'app';
  update public.huy_sync_signals
    set revision = v_revision, updated_at = clock_timestamp()
    where id = 'app';

  return jsonb_build_object('ok', true, 'serverTime', v_revision);
end;
$$;

create or replace function public.huy_auth_read()
returns jsonb
language sql
security definer
set search_path = pg_catalog, huy_private
as $$
  select jsonb_build_object('version', version, 'data', data)
  from huy_private.auth_state where id = 'app';
$$;

create or replace function public.huy_auth_cas(
  p_expected_version bigint,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, huy_private
as $$
declare
  v_current bigint;
begin
  select version into v_current from huy_private.auth_state where id = 'app' for update;
  if v_current <> p_expected_version then
    return jsonb_build_object('ok', false, 'code', 'stale_auth', 'version', v_current);
  end if;
  update huy_private.auth_state
    set version = version + 1, data = coalesce(p_data, '{}'::jsonb), updated_at = now()
    where id = 'app';
  return jsonb_build_object('ok', true, 'version', v_current + 1);
end;
$$;

create or replace function public.huy_audit_pull(p_since bigint default 0)
returns jsonb
language sql
security definer
set search_path = pg_catalog, huy_private
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', 'au' || id::text,
      'at', at,
      'actor', coalesce(actor->>'name', 'He thong'),
      'role', coalesce(actor->>'role', ''),
      'action', action,
      'col', collection,
      'recordId', record_id,
      'before', before_data,
      'after', after_data,
      'note', note,
      'updatedAt', revision,
      'deleted', false
    ) order by revision, id
  ), '[]'::jsonb)
  from huy_private.audit_log where revision > greatest(coalesce(p_since, 0), 0);
$$;

revoke all on function public.huy_snapshot() from public, anon, authenticated;
revoke all on function public.huy_pull(bigint, text[]) from public, anon, authenticated;
revoke all on function public.huy_commit_batch(bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.huy_auth_read() from public, anon, authenticated;
revoke all on function public.huy_auth_cas(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.huy_audit_pull(bigint) from public, anon, authenticated;

grant execute on function public.huy_snapshot() to service_role;
grant execute on function public.huy_pull(bigint, text[]) to service_role;
grant execute on function public.huy_commit_batch(bigint, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.huy_auth_read() to service_role;
grant execute on function public.huy_auth_cas(bigint, jsonb) to service_role;
grant execute on function public.huy_audit_pull(bigint) to service_role;

-- Idempotent: chi them bang vao publication neu chua co.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'huy_sync_signals'
  ) then
    alter publication supabase_realtime add table public.huy_sync_signals;
  end if;
end $$;

commit;
