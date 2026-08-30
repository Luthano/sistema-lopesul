-- Chat interno de atendimento (cliente + master) com Realtime

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
