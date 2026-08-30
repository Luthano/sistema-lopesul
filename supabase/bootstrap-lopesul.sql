-- Bootstrap Sistema Lopesul (sem Jetlu / Envia)
-- Cole este arquivo no SQL Editor do Supabase e rode uma vez.


-- ========== 001_historico.sql ==========

create table if not exists public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cnpj_pagador text,
  cnpj_remetente text,
  cnpj_destinatario text,
  cep_origem text,
  cep_destino text,
  valor_nf numeric,
  quantidade integer,
  peso numeric,
  volume numeric,
  total_frete numeric,
  prazo text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.coletas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  numero_coleta text,
  solicitante text,
  cep_coleta text,
  cep_entrega text,
  quantidade integer,
  peso numeric,
  limite_coleta timestamptz,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cotacoes_user_created_idx on public.cotacoes (user_id, created_at desc);
create index if not exists coletas_user_created_idx on public.coletas (user_id, created_at desc);

alter table public.cotacoes enable row level security;
alter table public.coletas enable row level security;

drop policy if exists cotacoes_select_own on public.cotacoes;
drop policy if exists cotacoes_insert_own on public.cotacoes;
drop policy if exists coletas_select_own on public.coletas;
drop policy if exists coletas_insert_own on public.coletas;

create policy cotacoes_select_own
  on public.cotacoes
  for select
  using (auth.uid() = user_id);

create policy cotacoes_insert_own
  on public.cotacoes
  for insert
  with check (auth.uid() = user_id);

create policy coletas_select_own
  on public.coletas
  for select
  using (auth.uid() = user_id);

create policy coletas_insert_own
  on public.coletas
  for insert
  with check (auth.uid() = user_id);


-- ========== 002_profiles_aprovacao.sql ==========

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  role text not null default 'user' check (role in ('user', 'master')),
  tipo_conta text not null default 'cliente' check (tipo_conta in ('cliente', 'atendimento', 'financeiro', 'comercial', 'agencias')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id)
);

create index if not exists profiles_status_idx on public.profiles (status, created_at desc);

create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'master'
      and status = 'approved'
  );
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'approved'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  master_emails text[] := array['luthanogomes@gmail.com', 'michael@lopesul.com'];
  is_master_email boolean;
begin
  is_master_email := lower(coalesce(new.email, '')) = any (master_emails);
  insert into public.profiles (id, email, status, role, approved_at)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    case when is_master_email then 'approved' else 'pending' end,
    case when is_master_email then 'master' else 'user' end,
    case when is_master_email then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, status, role, approved_at)
select
  id,
  lower(coalesce(email, '')),
  case when lower(coalesce(email, '')) in ('luthanogomes@gmail.com', 'michael@lopesul.com') then 'approved' else 'pending' end,
  case when lower(coalesce(email, '')) in ('luthanogomes@gmail.com', 'michael@lopesul.com') then 'master' else 'user' end,
  case when lower(coalesce(email, '')) in ('luthanogomes@gmail.com', 'michael@lopesul.com') then now() else null end
from auth.users
on conflict (id) do update
set
  email = excluded.email,
  role = excluded.role,
  status = case
    when excluded.role = 'master' then 'approved'
    else public.profiles.status
  end,
  approved_at = case
    when excluded.role = 'master' then coalesce(public.profiles.approved_at, now())
    else public.profiles.approved_at
  end;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own_or_master on public.profiles;
drop policy if exists profiles_update_master on public.profiles;

create policy profiles_select_own_or_master
  on public.profiles
  for select
  using (auth.uid() = id or public.is_master());

create policy profiles_update_master
  on public.profiles
  for update
  using (public.is_master())
  with check (public.is_master());

drop policy if exists cotacoes_select_own on public.cotacoes;
drop policy if exists cotacoes_insert_own on public.cotacoes;
drop policy if exists coletas_select_own on public.coletas;
drop policy if exists coletas_insert_own on public.coletas;

create policy cotacoes_select_own
  on public.cotacoes
  for select
  using (auth.uid() = user_id and public.is_approved());

create policy cotacoes_insert_own
  on public.cotacoes
  for insert
  with check (auth.uid() = user_id and public.is_approved());

create policy coletas_select_own
  on public.coletas
  for select
  using (auth.uid() = user_id and public.is_approved());

create policy coletas_insert_own
  on public.coletas
  for insert
  with check (auth.uid() = user_id and public.is_approved());


-- ========== 003_dados_cadastro.sql ==========

alter table public.profiles
  add column if not exists nome_completo text,
  add column if not exists endereco text,
  add column if not exists cpf text,
  add column if not exists cnpj text,
  add column if not exists telefone text,
  add column if not exists whatsapp text;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_master() then
    new.status := old.status;
    new.role := old.role;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.email := old.email;
    new.id := old.id;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ========== 004_excluir_conta.sql ==========

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  master_account boolean := false;
begin
  if uid is null then
    raise exception 'NÃ£o autenticado';
  end if;

  select role = 'master' into master_account
  from public.profiles
  where id = uid;

  if coalesce(master_account, false) then
    raise exception 'A conta master nÃ£o pode ser excluÃ­da por aqui.';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;


-- ========== 005_fix_profiles_colunas.sql ==========

alter table public.profiles
  add column if not exists nome_completo text,
  add column if not exists endereco text,
  add column if not exists cpf text,
  add column if not exists cnpj text,
  add column if not exists telefone text,
  add column if not exists whatsapp text;

notify pgrst, 'reload schema';


-- ========== 006_dacte_historico.sql ==========

-- HistÃ³rico de consultas DACTE / CT-e por usuÃ¡rio
create table if not exists public.dacte_consultas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cnpj_remetente text not null,
  nro_nf text not null,
  remetente text,
  destinatario text,
  pedido text,
  localizado boolean not null default false,
  mensagem text,
  consulted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, cnpj_remetente, nro_nf)
);

create index if not exists dacte_consultas_user_consulted_idx
  on public.dacte_consultas (user_id, consulted_at desc);

alter table public.dacte_consultas enable row level security;

drop policy if exists dacte_consultas_select_own on public.dacte_consultas;
drop policy if exists dacte_consultas_insert_own on public.dacte_consultas;
drop policy if exists dacte_consultas_update_own on public.dacte_consultas;
drop policy if exists dacte_consultas_delete_own on public.dacte_consultas;

create policy dacte_consultas_select_own
  on public.dacte_consultas
  for select
  using (auth.uid() = user_id);

create policy dacte_consultas_insert_own
  on public.dacte_consultas
  for insert
  with check (auth.uid() = user_id);

create policy dacte_consultas_update_own
  on public.dacte_consultas
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy dacte_consultas_delete_own
  on public.dacte_consultas
  for delete
  using (auth.uid() = user_id);


-- ========== 007_cobertura_cidades.sql ==========

-- Cobertura manual de cidades por transportadora (fonte da verdade pÃºblica)

create table if not exists public.transportadoras_cobertura (
  id text primary key,
  nome text not null,
  sigla text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transportadoras_cobertura_sigla_len check (char_length(trim(sigla)) between 1 and 6)
);

create table if not exists public.cobertura_cidades (
  id uuid primary key default gen_random_uuid(),
  transportadora_id text not null references public.transportadoras_cobertura (id) on delete cascade,
  uf text not null,
  cidade text not null,
  cidade_norm text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cobertura_cidades_uf_check check (uf ~ '^[A-Z]{2}$'),
  unique (transportadora_id, uf, cidade_norm)
);

create index if not exists cobertura_cidades_uf_idx
  on public.cobertura_cidades (uf, cidade_norm);

create index if not exists cobertura_cidades_carrier_uf_idx
  on public.cobertura_cidades (transportadora_id, uf);

create or replace function public.normalize_cidade(value text)
returns text
language sql
immutable
as $$
  select upper(
    trim(
      regexp_replace(
        regexp_replace(
          translate(
            lower(coalesce(value, '')),
            'Ã¡Ã Ã¢Ã£Ã¤Ã©Ã¨ÃªÃ«Ã­Ã¬Ã®Ã¯Ã³Ã²Ã´ÃµÃ¶ÃºÃ¹Ã»Ã¼Ã§Ã±',
            'aaaaaeeeeiiiiooooouuuucn'
          ),
          '[^a-z0-9\s]',
          ' ',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    )
  );
$$;

create or replace function public.cobertura_cidades_set_norm()
returns trigger
language plpgsql
as $$
begin
  new.uf := upper(trim(new.uf));
  new.cidade := trim(regexp_replace(new.cidade, '\s+', ' ', 'g'));
  new.cidade_norm := public.normalize_cidade(new.cidade);
  new.updated_at := now();
  if new.cidade_norm = '' then
    raise exception 'Informe o nome da cidade';
  end if;
  return new;
end;
$$;

drop trigger if exists cobertura_cidades_norm_trg on public.cobertura_cidades;
create trigger cobertura_cidades_norm_trg
  before insert or update on public.cobertura_cidades
  for each row execute function public.cobertura_cidades_set_norm();

create or replace function public.transportadoras_cobertura_touch()
returns trigger
language plpgsql
as $$
begin
  new.id := lower(trim(new.id));
  new.sigla := upper(trim(new.sigla));
  new.nome := trim(new.nome);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists transportadoras_cobertura_touch_trg on public.transportadoras_cobertura;
create trigger transportadoras_cobertura_touch_trg
  before insert or update on public.transportadoras_cobertura
  for each row execute function public.transportadoras_cobertura_touch();

alter table public.transportadoras_cobertura enable row level security;
alter table public.cobertura_cidades enable row level security;

drop policy if exists transportadoras_cobertura_select_all on public.transportadoras_cobertura;
drop policy if exists transportadoras_cobertura_write_master on public.transportadoras_cobertura;
drop policy if exists cobertura_cidades_select_all on public.cobertura_cidades;
drop policy if exists cobertura_cidades_write_master on public.cobertura_cidades;

-- Leitura pÃºblica (pÃ¡gina de cidades / API)
create policy transportadoras_cobertura_select_all
  on public.transportadoras_cobertura
  for select
  using (true);

create policy cobertura_cidades_select_all
  on public.cobertura_cidades
  for select
  using (true);

-- Escrita apenas master
create policy transportadoras_cobertura_write_master
  on public.transportadoras_cobertura
  for all
  using (public.is_master())
  with check (public.is_master());

create policy cobertura_cidades_write_master
  on public.cobertura_cidades
  for all
  using (public.is_master())
  with check (public.is_master());

insert into public.transportadoras_cobertura (id, nome, sigla, ativo, ordem)
values
  ('lopesul', 'Lopesul', 'LS', true, 1)
on conflict (id) do update
set
  nome = excluded.nome,
  sigla = excluded.sigla,
  ativo = excluded.ativo,
  ordem = excluded.ordem,
  updated_at = now();


-- ========== 009_veiculos_parceiros.sql ==========

-- Cadastro de veÃ­culos parceiros (pÃºblico + conta Lopesul + aprovaÃ§Ã£o master)

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

-- Se a 009 antiga jÃ¡ rodou sem user_id / notas_master / marca:
alter table public.veiculos_parceiros
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.veiculos_parceiros
  add column if not exists notas_master text;

alter table public.veiculos_parceiros
  add column if not exists marca text;

update public.veiculos_parceiros
set marca = 'NÃ£o informado'
where marca is null or trim(marca) = '';

alter table public.veiculos_parceiros
  alter column marca set default 'NÃ£o informado';

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
      raise exception 'user_id invÃ¡lido';
    end if;
    new.status := 'novo';
    new.notas_master := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Reivindicar cadastro anÃ´nimo pelo mesmo e-mail da conta
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
      raise exception 'Sem permissÃ£o para editar este veÃ­culo';
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

-- Permitir reivindicar registro anÃ´nimo com o mesmo e-mail
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


-- ========== 010_veiculos_marca.sql ==========

-- Garante coluna marca em ambientes que jÃ¡ aplicaram a 009 anterior

alter table public.veiculos_parceiros
  add column if not exists marca text;

update public.veiculos_parceiros
set marca = 'NÃ£o informado'
where marca is null or trim(marca) = '';

alter table public.veiculos_parceiros
  alter column marca set default 'NÃ£o informado';

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


-- ========== 012_profiles_cadastro_update.sql ==========

-- Garante colunas de cadastro + permissÃ£o de o prÃ³prio usuÃ¡rio atualizar o perfil.
-- Sem profiles_update_own, o update parece "ok" no app mas nÃ£o grava nenhuma linha.

alter table public.profiles
  add column if not exists nome_completo text,
  add column if not exists endereco text,
  add column if not exists cpf text,
  add column if not exists cnpj text,
  add column if not exists telefone text,
  add column if not exists whatsapp text;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_master() then
    new.status := old.status;
    new.role := old.role;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.email := old.email;
    new.id := old.id;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, update on public.profiles to authenticated;

notify pgrst, 'reload schema';


-- ========== 013_profiles_aprovacao_exclusao.sql ==========

-- ReforÃ§a aprovar/recusar (master) e exclusÃ£o de conta no banco.

-- Master precisa poder atualizar status de outros perfis
drop policy if exists profiles_update_master on public.profiles;
create policy profiles_update_master
  on public.profiles
  for update
  using (public.is_master())
  with check (public.is_master());

-- UsuÃ¡rio atualiza sÃ³ o prÃ³prio cadastro (campos protegidos pelo trigger)
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_master() then
    new.status := old.status;
    new.role := old.role;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.email := old.email;
    new.id := old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ExclusÃ£o da prÃ³pria conta (cascade em profiles/cotacoes/coletas)
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  master_account boolean := false;
begin
  if uid is null then
    raise exception 'NÃ£o autenticado';
  end if;

  select role = 'master' into master_account
  from public.profiles
  where id = uid;

  if coalesce(master_account, false) then
    raise exception 'A conta master nÃ£o pode ser excluÃ­da por aqui.';
  end if;

  delete from auth.users where id = uid;

  if not found then
    raise exception 'Conta nÃ£o encontrada para exclusÃ£o.';
  end if;
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

-- Master exclui usuÃ¡rio (nÃ£o master)
create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'NÃ£o autenticado';
  end if;

  if not public.is_master() then
    raise exception 'Apenas o master pode excluir usuÃ¡rios.';
  end if;

  if target_id is null or target_id = auth.uid() then
    raise exception 'NÃ£o Ã© possÃ­vel excluir esta conta por aqui.';
  end if;

  select role into target_role
  from public.profiles
  where id = target_id;

  if target_role is null then
    raise exception 'UsuÃ¡rio nÃ£o encontrado.';
  end if;

  if target_role = 'master' then
    raise exception 'NÃ£o Ã© possÃ­vel excluir uma conta master.';
  end if;

  delete from auth.users where id = target_id;

  if not found then
    raise exception 'Falha ao excluir o usuÃ¡rio no Auth.';
  end if;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
revoke all on function public.admin_delete_user(uuid) from anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ========== 014_atendimento_chat.sql ==========

create table if not exists public.atendimento_conversas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.profiles (id) on delete cascade,
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  ultima_mensagem_at timestamptz,
  preview text,
  nao_lidas_cliente integer not null default 0 check (nao_lidas_cliente >= 0),
  nao_lidas_master integer not null default 0 check (nao_lidas_master >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.atendimento_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.atendimento_conversas (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  papel text not null check (papel in ('cliente', 'atendente')),
  corpo text not null,
  created_at timestamptz not null default now(),
  constraint atendimento_mensagens_corpo_check check (char_length(trim(corpo)) between 1 and 2000)
);

create index if not exists atendimento_conversas_ultima_idx
  on public.atendimento_conversas (status, ultima_mensagem_at desc nulls last);

create index if not exists atendimento_conversas_master_nao_lidas_idx
  on public.atendimento_conversas (nao_lidas_master desc, ultima_mensagem_at desc);

create index if not exists atendimento_mensagens_conversa_idx
  on public.atendimento_mensagens (conversa_id, created_at);

create or replace function public.atendimento_apos_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.corpo := trim(regexp_replace(coalesce(new.corpo, ''), '\s+', ' ', 'g'));

  update public.atendimento_conversas
  set
    status = 'aberta',
    ultima_mensagem_at = coalesce(new.created_at, now()),
    preview = left(new.corpo, 140),
    nao_lidas_cliente = case
      when new.papel = 'atendente' then nao_lidas_cliente + 1
      else nao_lidas_cliente
    end,
    nao_lidas_master = case
      when new.papel = 'cliente' then nao_lidas_master + 1
      else nao_lidas_master
    end
  where id = new.conversa_id;

  return new;
end;
$$;

drop trigger if exists atendimento_mensagens_after_ins on public.atendimento_mensagens;
drop trigger if exists atendimento_mensagens_before_ins on public.atendimento_mensagens;

create trigger atendimento_mensagens_before_ins
  before insert on public.atendimento_mensagens
  for each row execute function public.atendimento_apos_mensagem();

create or replace function public.atendimento_conversas_update_guard()
returns trigger
language plpgsql
as $$
begin
  if public.is_master() then
    return new;
  end if;

  new.cliente_id := old.cliente_id;
  new.status := old.status;
  new.ultima_mensagem_at := old.ultima_mensagem_at;
  new.preview := old.preview;
  new.nao_lidas_master := old.nao_lidas_master;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists atendimento_conversas_guard on public.atendimento_conversas;
create trigger atendimento_conversas_guard
  before update on public.atendimento_conversas
  for each row execute function public.atendimento_conversas_update_guard();

alter table public.atendimento_conversas enable row level security;
alter table public.atendimento_mensagens enable row level security;

drop policy if exists atendimento_conversas_select on public.atendimento_conversas;
drop policy if exists atendimento_conversas_insert on public.atendimento_conversas;
drop policy if exists atendimento_conversas_update on public.atendimento_conversas;
drop policy if exists atendimento_mensagens_select on public.atendimento_mensagens;
drop policy if exists atendimento_mensagens_insert on public.atendimento_mensagens;

create policy atendimento_conversas_select
  on public.atendimento_conversas
  for select
  using (auth.uid() = cliente_id or public.is_master());

create policy atendimento_conversas_insert
  on public.atendimento_conversas
  for insert
  with check (auth.uid() = cliente_id and not public.is_master());

create policy atendimento_conversas_update
  on public.atendimento_conversas
  for update
  using (auth.uid() = cliente_id or public.is_master())
  with check (auth.uid() = cliente_id or public.is_master());

create policy atendimento_mensagens_select
  on public.atendimento_mensagens
  for select
  using (
    public.is_master()
    or exists (
      select 1
      from public.atendimento_conversas c
      where c.id = conversa_id
        and c.cliente_id = auth.uid()
    )
  );

create policy atendimento_mensagens_insert
  on public.atendimento_mensagens
  for insert
  with check (
    autor_id = auth.uid()
    and (
      (
        papel = 'cliente'
        and not public.is_master()
        and exists (
          select 1
          from public.atendimento_conversas c
          where c.id = conversa_id
            and c.cliente_id = auth.uid()
        )
      )
      or (
        papel = 'atendente'
        and public.is_master()
      )
    )
  );

alter table public.atendimento_conversas replica identity full;
alter table public.atendimento_mensagens replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.atendimento_conversas;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.atendimento_mensagens;
exception
  when duplicate_object then null;
end $$;

grant select, insert, update on public.atendimento_conversas to authenticated;
grant select, insert on public.atendimento_mensagens to authenticated;

-- ========== 015_atendimento_setores.sql ==========

alter table public.atendimento_conversas
  add column if not exists setor text;

update public.atendimento_conversas
set setor = 'administrativo'
where setor is null or trim(setor) = '';

alter table public.atendimento_conversas
  drop constraint if exists atendimento_conversas_cliente_id_key;

do $$
begin
  alter table public.atendimento_conversas
    drop constraint if exists atendimento_conversas_setor_check;
  alter table public.atendimento_conversas
    add constraint atendimento_conversas_setor_check
    check (setor in ('financeiro', 'agencias', 'administrativo', 'comercial'));
exception
  when others then null;
end $$;

alter table public.atendimento_conversas
  alter column setor set default 'administrativo';

do $$
begin
  alter table public.atendimento_conversas
    alter column setor set not null;
exception
  when others then null;
end $$;

create unique index if not exists atendimento_conversas_cliente_setor_uidx
  on public.atendimento_conversas (cliente_id, setor);

create or replace function public.atendimento_conversas_update_guard()
returns trigger
language plpgsql
as $$
begin
  if public.is_master() then
    return new;
  end if;

  new.cliente_id := old.cliente_id;
  new.setor := old.setor;
  new.status := old.status;
  new.ultima_mensagem_at := old.ultima_mensagem_at;
  new.preview := old.preview;
  new.nao_lidas_master := old.nao_lidas_master;
  new.created_at := old.created_at;
  return new;
end;
$$;

notify pgrst, 'reload schema';

-- ========== 016_atendimento_anexos.sql ==========

alter table public.atendimento_mensagens
  add column if not exists tipo text not null default 'texto';

alter table public.atendimento_mensagens
  add column if not exists arquivo_path text;

alter table public.atendimento_mensagens
  add column if not exists arquivo_nome text;

alter table public.atendimento_mensagens
  add column if not exists arquivo_mime text;

alter table public.atendimento_mensagens
  add column if not exists arquivo_tamanho integer;

alter table public.atendimento_mensagens
  drop constraint if exists atendimento_mensagens_tipo_check;

alter table public.atendimento_mensagens
  add constraint atendimento_mensagens_tipo_check
  check (tipo in ('texto', 'imagem', 'audio', 'video', 'documento'));

alter table public.atendimento_mensagens
  drop constraint if exists atendimento_mensagens_corpo_check;

alter table public.atendimento_mensagens
  add constraint atendimento_mensagens_corpo_check
  check (
    (
      arquivo_path is not null
      and char_length(trim(coalesce(corpo, ''))) <= 2000
    )
    or (
      arquivo_path is null
      and char_length(trim(coalesce(corpo, ''))) between 1 and 2000
    )
  );

alter table public.atendimento_mensagens
  drop constraint if exists atendimento_mensagens_arquivo_check;

alter table public.atendimento_mensagens
  add constraint atendimento_mensagens_arquivo_check
  check (
    (tipo = 'texto' and arquivo_path is null)
    or (
      tipo <> 'texto'
      and arquivo_path is not null
      and char_length(arquivo_path) between 1 and 500
    )
  );

create or replace function public.atendimento_apos_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preview_txt text;
  rotulo text;
  texto text;
begin
  new.corpo := trim(regexp_replace(coalesce(new.corpo, ''), '\s+', ' ', 'g'));
  new.tipo := coalesce(nullif(trim(new.tipo), ''), 'texto');

  texto := new.corpo;
  if new.arquivo_path is null then
    preview_txt := left(texto, 140);
  else
    rotulo := case new.tipo
      when 'imagem' then 'Imagem'
      when 'audio' then 'Áudio'
      when 'video' then 'Vídeo'
      else 'Documento'
    end;
    preview_txt := case
      when texto <> '' then left(rotulo || ' · ' || texto, 140)
      else rotulo
    end;
  end if;

  update public.atendimento_conversas
  set
    status = 'aberta',
    ultima_mensagem_at = coalesce(new.created_at, now()),
    preview = preview_txt,
    nao_lidas_cliente = case
      when new.papel = 'atendente' then nao_lidas_cliente + 1
      else nao_lidas_cliente
    end,
    nao_lidas_master = case
      when new.papel = 'cliente' then nao_lidas_master + 1
      else nao_lidas_master
    end
  where id = new.conversa_id;

  return new;
end;
$$;

create or replace function public.atendimento_pode_usar_pasta(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.atendimento_conversas c
    where c.id::text = split_part(object_name, '/', 1)
      and (c.cliente_id = auth.uid() or public.is_master())
  );
$$;

grant execute on function public.atendimento_pode_usar_pasta(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('atendimento', 'atendimento', false, 52428800)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists atendimento_arquivos_select on storage.objects;
drop policy if exists atendimento_arquivos_insert on storage.objects;

create policy atendimento_arquivos_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'atendimento'
    and public.atendimento_pode_usar_pasta(name)
  );

create policy atendimento_arquivos_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'atendimento'
    and public.atendimento_pode_usar_pasta(name)
  );

-- ========== 018_tipo_conta.sql ==========
-- Tipo de conta (cliente ou equipe por setor). Só o master altera.

alter table public.profiles
  add column if not exists tipo_conta text not null default 'cliente';

alter table public.profiles
  drop constraint if exists profiles_tipo_conta_check;

alter table public.profiles
  add constraint profiles_tipo_conta_check
  check (tipo_conta in ('cliente', 'atendimento', 'financeiro', 'comercial', 'agencias'));

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_master() then
    new.status := old.status;
    new.role := old.role;
    new.tipo_conta := old.tipo_conta;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.email := old.email;
    new.id := old.id;
  end if;
  return new;
end;
$$;

create or replace function public.tipo_conta_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.tipo_conta
      from public.profiles p
      where p.id = auth.uid()
        and p.status = 'approved'
    ),
    ''
  );
$$;

create or replace function public.is_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tipo_conta_atual() in ('atendimento', 'financeiro', 'comercial', 'agencias');
$$;

create or replace function public.pode_atender(p_setor text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_master()
    or public.tipo_conta_atual() = 'atendimento'
    or (
      public.tipo_conta_atual() in ('financeiro', 'comercial', 'agencias')
      and public.tipo_conta_atual() = p_setor
    );
$$;

grant execute on function public.tipo_conta_atual() to authenticated;
grant execute on function public.is_equipe() to authenticated;
grant execute on function public.pode_atender(text) to authenticated;

do $$
begin
  alter table public.atendimento_conversas
    drop constraint if exists atendimento_conversas_setor_check;
  alter table public.atendimento_conversas
    add constraint atendimento_conversas_setor_check
    check (setor in ('financeiro', 'agencias', 'administrativo', 'comercial'));
exception
  when others then null;
end $$;

create or replace function public.atendimento_conversas_update_guard()
returns trigger
language plpgsql
as $$
begin
  if public.is_master() then
    return new;
  end if;

  if public.pode_atender(old.setor) then
    new.cliente_id := old.cliente_id;
    new.setor := old.setor;
    new.status := old.status;
    new.ultima_mensagem_at := old.ultima_mensagem_at;
    new.preview := old.preview;
    new.nao_lidas_cliente := old.nao_lidas_cliente;
    new.created_at := old.created_at;
    return new;
  end if;

  new.cliente_id := old.cliente_id;
  new.setor := old.setor;
  new.status := old.status;
  new.ultima_mensagem_at := old.ultima_mensagem_at;
  new.preview := old.preview;
  new.nao_lidas_master := old.nao_lidas_master;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop policy if exists atendimento_conversas_select on public.atendimento_conversas;
drop policy if exists atendimento_conversas_insert on public.atendimento_conversas;
drop policy if exists atendimento_conversas_update on public.atendimento_conversas;
drop policy if exists atendimento_mensagens_select on public.atendimento_mensagens;
drop policy if exists atendimento_mensagens_insert on public.atendimento_mensagens;

create policy atendimento_conversas_select
  on public.atendimento_conversas
  for select
  using (auth.uid() = cliente_id or public.pode_atender(setor));

create policy atendimento_conversas_insert
  on public.atendimento_conversas
  for insert
  with check (auth.uid() = cliente_id and not public.is_master() and not public.is_equipe());

create policy atendimento_conversas_update
  on public.atendimento_conversas
  for update
  using (auth.uid() = cliente_id or public.pode_atender(setor))
  with check (auth.uid() = cliente_id or public.pode_atender(setor));

create policy atendimento_mensagens_select
  on public.atendimento_mensagens
  for select
  using (
    exists (
      select 1
      from public.atendimento_conversas c
      where c.id = conversa_id
        and (c.cliente_id = auth.uid() or public.pode_atender(c.setor))
    )
  );

create policy atendimento_mensagens_insert
  on public.atendimento_mensagens
  for insert
  with check (
    autor_id = auth.uid()
    and (
      (
        papel = 'cliente'
        and not public.is_master()
        and not public.is_equipe()
        and exists (
          select 1
          from public.atendimento_conversas c
          where c.id = conversa_id
            and c.cliente_id = auth.uid()
        )
      )
      or (
        papel = 'atendente'
        and exists (
          select 1
          from public.atendimento_conversas c
          where c.id = conversa_id
            and public.pode_atender(c.setor)
        )
      )
    )
  );

create or replace function public.atendimento_pode_usar_pasta(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.atendimento_conversas c
    where c.id::text = split_part(object_name, '/', 1)
      and (c.cliente_id = auth.uid() or public.pode_atender(c.setor))
  );
$$;

