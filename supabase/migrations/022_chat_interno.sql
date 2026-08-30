-- Internos conversam entre si. Cliente só fala com equipe; cliente nunca lista outro cliente.

create or replace function public.eh_interno(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_id
      and p.status = 'approved'
      and (
        p.role = 'master'
        or p.tipo_conta in ('suporte', 'atendimento', 'financeiro', 'comercial', 'agencias')
      )
  );
$$;

grant execute on function public.eh_interno(uuid) to authenticated;

drop policy if exists atendimento_conversas_insert on public.atendimento_conversas;
create policy atendimento_conversas_insert
  on public.atendimento_conversas
  for insert
  with check (
    auth.uid() = cliente_id
    and atendente_id is not null
    and atendente_id <> cliente_id
    and public.eh_interno(atendente_id)
  );

drop policy if exists atendimento_mensagens_insert on public.atendimento_mensagens;
create policy atendimento_mensagens_insert
  on public.atendimento_mensagens
  for insert
  with check (
    autor_id = auth.uid()
    and (
      (
        papel = 'cliente'
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
