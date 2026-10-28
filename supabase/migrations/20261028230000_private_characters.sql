-- Worlds Beyond: private cloud character saves (phase 2).
-- Apply using Supabase SQL Editor before enabling the Cloud Saves page.
-- Publishable/anon keys are safe only with these database policies in place.
create table if not exists public.wb_characters (
  owner_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null check (length(character_id) between 1 and 100),
  name text not null check (length(name) between 1 and 100),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  primary key (owner_id,character_id)
);
create index if not exists wb_characters_owner_updated_idx
  on public.wb_characters (owner_id,updated_at desc);
alter table public.wb_characters enable row level security;

-- Never expose any anonymous database writes or reads. Every operation is
-- restricted by the authenticated user's JWT, not by client-side parameters.
revoke all on public.wb_characters from anon, authenticated;
grant select,insert,update,delete on public.wb_characters to authenticated;

drop policy if exists "wb_characters_select_own" on public.wb_characters;
create policy "wb_characters_select_own" on public.wb_characters
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "wb_characters_insert_own" on public.wb_characters;
create policy "wb_characters_insert_own" on public.wb_characters
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "wb_characters_update_own" on public.wb_characters;
create policy "wb_characters_update_own" on public.wb_characters
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "wb_characters_delete_own" on public.wb_characters;
create policy "wb_characters_delete_own" on public.wb_characters
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Don't allow callers to silently backdate updated_at on edit. This trigger
-- is harmless for inserts; conditional updates (revision CAS) remain atomic.
create or replace function public.wb_characters_set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists wb_characters_timestamp on public.wb_characters;
create trigger wb_characters_timestamp before update on public.wb_characters
  for each row execute function public.wb_characters_set_updated_at();

-- Test with two real Supabase Auth accounts: user A must not be able to list,
-- read, create under, edit or delete user B's character. Database policies
-- protect access, but cloud availability is not enabled by this SQL alone.