-- Tipo e departamento Suporte. Masters ficam nesse tipo para o cliente escolher.

alter table public.profiles
  drop constraint if exists profiles_tipo_conta_check;

alter table public.profiles
  add constraint profiles_tipo_conta_check
  check (tipo_conta in ('cliente', 'suporte', 'atendimento', 'financeiro', 'comercial', 'agencias'));

create or replace function public.is_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tipo_conta_atual() in ('suporte', 'atendimento', 'financeiro', 'comercial', 'agencias');
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
      public.tipo_conta_atual() in ('suporte', 'financeiro', 'comercial', 'agencias')
      and public.tipo_conta_atual() = p_setor
    );
$$;

do $$
begin
  alter table public.atendimento_conversas
    drop constraint if exists atendimento_conversas_setor_check;
  alter table public.atendimento_conversas
    add constraint atendimento_conversas_setor_check
    check (setor in ('financeiro', 'agencias', 'administrativo', 'comercial', 'suporte'));
exception
  when others then null;
end $$;

drop policy if exists profiles_select_equipe on public.profiles;
create policy profiles_select_equipe
  on public.profiles
  for select
  to authenticated
  using (
    status = 'approved'
    and (
      role = 'master'
      or tipo_conta in ('suporte', 'atendimento', 'financeiro', 'comercial', 'agencias')
    )
  );

alter table public.profiles disable trigger protect_profile_fields;

update public.profiles
set tipo_conta = 'suporte'
where role = 'master';

alter table public.profiles enable trigger protect_profile_fields;
