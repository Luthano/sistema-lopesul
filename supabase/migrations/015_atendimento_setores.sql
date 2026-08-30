-- Uma conversa por cliente + setor (financeiro, agencias, administrativo)

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
    check (setor in ('financeiro', 'agencias', 'administrativo'));
exception
  when others then null;
end $$;

update public.atendimento_conversas
set setor = 'administrativo'
where setor is null;

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
