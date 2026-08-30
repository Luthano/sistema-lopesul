-- Cliente, atendente e master podem apagar a conversa inteira (mensagens em cascade).

grant delete on public.atendimento_conversas to authenticated;

drop policy if exists atendimento_conversas_delete on public.atendimento_conversas;
create policy atendimento_conversas_delete
  on public.atendimento_conversas
  for delete
  using (
    auth.uid() = cliente_id
    or auth.uid() = atendente_id
    or public.is_master()
    or public.pode_atender(setor)
  );

drop policy if exists atendimento_arquivos_delete on storage.objects;
create policy atendimento_arquivos_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'atendimento'
    and public.atendimento_pode_usar_pasta(name)
  );
