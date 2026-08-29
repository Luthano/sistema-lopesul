-- Cobertura manual de cidades por transportadora (fonte da verdade pública)

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
            'áàâãäéèêëíìîïóòôõöúùûüçñ',
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

-- Leitura pública (página de cidades / API)
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
