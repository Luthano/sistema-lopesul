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
