-- Cliente escolhe a pessoa do departamento. Conversas passam a ter atendente.

alter table public.atendimento_conversas
  add column if not exists atendente_id uuid references public.profiles (id) on delete set null;

drop index if exists public.atendimento_conversas_cliente_setor_uidx;

create unique index if not exists atendimento_conversas_cliente_setor_atendente_uidx
  on public.atendimento_conversas (cliente_id, setor, atendente_id);

drop policy if exists profiles_select_equipe on public.profiles;
create policy profiles_select_equipe
  on public.profiles
  for select
  to authenticated
  using (
    status = 'approved'
    and (
      role = 'master'
      or tipo_conta in ('atendimento', 'financeiro', 'comercial', 'agencias')
    )
  );

create or replace function public.atendimento_conversas_update_guard()
returns trigger
language plpgsql
as $$
begin
  if public.is_master() then
    return new;
  end if;

  if old.atendente_id = auth.uid() or public.pode_atender(old.setor) then
    new.cliente_id := old.cliente_id;
    new.setor := old.setor;
    new.atendente_id := old.atendente_id;
    new.status := old.status;
    new.ultima_mensagem_at := old.ultima_mensagem_at;
    new.preview := old.preview;
    new.nao_lidas_cliente := old.nao_lidas_cliente;
    new.created_at := old.created_at;
    return new;
  end if;

  new.cliente_id := old.cliente_id;
  new.setor := old.setor;
  new.atendente_id := old.atendente_id;
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
  using (
    auth.uid() = cliente_id
    or auth.uid() = atendente_id
    or public.is_master()
    or public.pode_atender(setor)
  );

create policy atendimento_conversas_insert
  on public.atendimento_conversas
  for insert
  with check (auth.uid() = cliente_id and not public.is_master() and not public.is_equipe());

create policy atendimento_conversas_update
  on public.atendimento_conversas
  for update
  using (
    auth.uid() = cliente_id
    or auth.uid() = atendente_id
    or public.is_master()
    or public.pode_atender(setor)
  )
  with check (
    auth.uid() = cliente_id
    or auth.uid() = atendente_id
    or public.is_master()
    or public.pode_atender(setor)
  );

create policy atendimento_mensagens_select
  on public.atendimento_mensagens
  for select
  using (
    exists (
      select 1
      from public.atendimento_conversas c
      where c.id = conversa_id
        and (
          c.cliente_id = auth.uid()
          or c.atendente_id = auth.uid()
          or public.is_master()
          or public.pode_atender(c.setor)
        )
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
            and (
              c.atendente_id = auth.uid()
              or public.is_master()
              or public.pode_atender(c.setor)
            )
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
      and (
        c.cliente_id = auth.uid()
        or c.atendente_id = auth.uid()
        or public.is_master()
        or public.pode_atender(c.setor)
      )
  );
$$;
