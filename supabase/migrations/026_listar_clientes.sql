-- Equipe vê clientes aprovados e pode abrir conversa com eles.

drop policy if exists profiles_select_clientes on public.profiles;
create policy profiles_select_clientes
  on public.profiles
  for select
  to authenticated
  using (
    status = 'approved'
    and tipo_conta = 'cliente'
    and (public.is_master() or public.is_equipe())
  );

drop policy if exists atendimento_conversas_insert on public.atendimento_conversas;
create policy atendimento_conversas_insert
  on public.atendimento_conversas
  for insert
  with check (
    atendente_id is not null
    and atendente_id <> cliente_id
    and public.eh_interno(atendente_id)
    and (
      auth.uid() = cliente_id
      or (
        auth.uid() = atendente_id
        and public.eh_interno(auth.uid())
        and not public.eh_interno(cliente_id)
      )
    )
  );

notify pgrst, 'reload schema';
