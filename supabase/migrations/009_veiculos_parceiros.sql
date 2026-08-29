-- Cadastro de veículos parceiros (público + conta Lopesul + aprovação master)

create table if not exists public.veiculos_parceiros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  marca text not null,
  ano integer not null,
  modelo text not null,
  cor text not null,
  rotas text not null,
  nome text,
  telefone text,
  email text,
  status text not null default 'novo'
    check (status in ('novo', 'em_contato', 'aprovado', 'recusado')),
  notas_master text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint veiculos_parceiros_marca_check check (char_length(trim(marca)) between 2 and 80),
  constraint veiculos_parceiros_ano_check check (ano between 1980 and 2100),
  constraint veiculos_parceiros_modelo_check check (char_length(trim(modelo)) between 2 and 120),
  constraint veiculos_parceiros_cor_check check (char_length(trim(cor)) between 2 and 60),
  constraint veiculos_parceiros_rotas_check check (char_length(trim(rotas)) between 3 and 2000)
);

-- Se a 009 antiga já rodou sem user_id / notas_master / marca:
alter table public.veiculos_parceiros
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.veiculos_parceiros
  add column if not exists notas_master text;

alter table public.veiculos_parceiros
  add column if not exists marca text;

update public.veiculos_parceiros
set marca = 'Não informado'
where marca is null or trim(marca) = '';

alter table public.veiculos_parceiros
  alter column marca set default 'Não informado';

do $$
begin
  alter table public.veiculos_parceiros
    alter column marca set not null;
exception
  when others then
    null;
end $$;

do $$
begin
  alter table public.veiculos_parceiros
    drop constraint if exists veiculos_parceiros_marca_check;
  alter table public.veiculos_parceiros
    add constraint veiculos_parceiros_marca_check check (char_length(trim(marca)) between 2 and 80);
exception
  when others then
    null;
end $$;

create index if not exists veiculos_parceiros_created_idx
  on public.veiculos_parceiros (created_at desc);

create index if not exists veiculos_parceiros_status_idx
  on public.veiculos_parceiros (status);

create index if not exists veiculos_parceiros_user_idx
  on public.veiculos_parceiros (user_id);

create or replace function public.veiculos_parceiros_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.marca := trim(regexp_replace(coalesce(new.marca, ''), '\s+', ' ', 'g'));
  new.modelo := trim(regexp_replace(coalesce(new.modelo, ''), '\s+', ' ', 'g'));
  new.cor := trim(regexp_replace(coalesce(new.cor, ''), '\s+', ' ', 'g'));
  new.rotas := trim(regexp_replace(coalesce(new.rotas, ''), '\s+', ' ', 'g'));
  if new.nome is not null then
    new.nome := nullif(trim(regexp_replace(new.nome, '\s+', ' ', 'g')), '');
  end if;
  if new.telefone is not null then
    new.telefone := nullif(trim(new.telefone), '');
  end if;
  if new.email is not null then
    new.email := nullif(lower(trim(new.email)), '');
  end if;
  if new.notas_master is not null then
    new.notas_master := nullif(trim(new.notas_master), '');
  end if;
  return new;
end;
$$;

drop trigger if exists veiculos_parceiros_touch_trg on public.veiculos_parceiros;
create trigger veiculos_parceiros_touch_trg
  before insert or update on public.veiculos_parceiros
  for each row execute function public.veiculos_parceiros_touch();

-- Impede que o dono altere status/notas; permite reivindicar cadastro pelo e-mail
create or replace function public.veiculos_parceiros_guard_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_email text;
begin
  if public.is_master() then
    return new;
  end if;

  jwt_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));

  if tg_op = 'INSERT' then
    if auth.uid() is null then
      new.user_id := null;
    elsif new.user_id is distinct from auth.uid() then
      raise exception 'user_id inválido';
    end if;
    new.status := 'novo';
    new.notas_master := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Reivindicar cadastro anônimo pelo mesmo e-mail da conta
    if old.user_id is null
      and new.user_id = auth.uid()
      and jwt_email is not null
      and lower(coalesce(old.email, '')) = jwt_email
    then
      new.status := old.status;
      new.notas_master := old.notas_master;
      return new;
    end if;

    if old.user_id is distinct from auth.uid() then
      raise exception 'Sem permissão para editar este veículo';
    end if;

    new.user_id := old.user_id;
    new.status := old.status;
    new.notas_master := old.notas_master;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists veiculos_parceiros_guard_trg on public.veiculos_parceiros;
create trigger veiculos_parceiros_guard_trg
  before insert or update on public.veiculos_parceiros
  for each row execute function public.veiculos_parceiros_guard_owner();

alter table public.veiculos_parceiros enable row level security;

drop policy if exists veiculos_parceiros_insert_public on public.veiculos_parceiros;
drop policy if exists veiculos_parceiros_insert_anon on public.veiculos_parceiros;
drop policy if exists veiculos_parceiros_insert_auth on public.veiculos_parceiros;
drop policy if exists veiculos_parceiros_select_master on public.veiculos_parceiros;
drop policy if exists veiculos_parceiros_select_own on public.veiculos_parceiros;
drop policy if exists veiculos_parceiros_update_master on public.veiculos_parceiros;
drop policy if exists veiculos_parceiros_update_own on public.veiculos_parceiros;
drop policy if exists veiculos_parceiros_claim on public.veiculos_parceiros;

create policy veiculos_parceiros_insert_anon
  on public.veiculos_parceiros
  for insert
  to anon
  with check (user_id is null);

create policy veiculos_parceiros_insert_auth
  on public.veiculos_parceiros
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy veiculos_parceiros_select_own
  on public.veiculos_parceiros
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_master());

create policy veiculos_parceiros_update_own
  on public.veiculos_parceiros
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_master())
  with check (user_id = auth.uid() or public.is_master());

-- Permitir reivindicar registro anônimo com o mesmo e-mail
create policy veiculos_parceiros_claim
  on public.veiculos_parceiros
  for update
  to authenticated
  using (
    user_id is null
    and email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (user_id = auth.uid());

grant select, insert, update on public.veiculos_parceiros to authenticated;
grant insert on public.veiculos_parceiros to anon;
