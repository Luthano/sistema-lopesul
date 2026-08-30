-- Qualquer usuário apaga só as próprias mensagens.

grant delete on public.atendimento_mensagens to authenticated;

drop policy if exists atendimento_mensagens_delete on public.atendimento_mensagens;
create policy atendimento_mensagens_delete
  on public.atendimento_mensagens
  for delete
  using (autor_id = auth.uid());

create or replace function public.atendimento_conversas_update_guard()
returns trigger
language plpgsql
as $$
begin
  if current_setting('lopesul.atendimento_interno', true) = 'on' then
    return new;
  end if;

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

create or replace function public.atendimento_apos_apagar_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ultima record;
begin
  perform set_config('lopesul.atendimento_interno', 'on', true);

  select corpo, tipo, created_at
  into ultima
  from public.atendimento_mensagens
  where conversa_id = old.conversa_id
  order by created_at desc
  limit 1;

  update public.atendimento_conversas
  set
    preview = case
      when ultima.created_at is null then null
      when nullif(trim(coalesce(ultima.corpo, '')), '') is not null then left(ultima.corpo, 140)
      when ultima.tipo = 'imagem' then 'Imagem'
      when ultima.tipo = 'audio' then 'Áudio'
      when ultima.tipo = 'video' then 'Vídeo'
      when ultima.tipo = 'documento' then 'Documento'
      else null
    end,
    ultima_mensagem_at = ultima.created_at
  where id = old.conversa_id;

  return old;
end;
$$;

drop trigger if exists atendimento_mensagens_after_del on public.atendimento_mensagens;
create trigger atendimento_mensagens_after_del
  after delete on public.atendimento_mensagens
  for each row execute function public.atendimento_apos_apagar_mensagem();

notify pgrst, 'reload schema';
