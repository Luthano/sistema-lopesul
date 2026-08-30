-- Apagar mensagem só esconde para quem escreveu. O outro lado continua vendo.

alter table public.atendimento_mensagens
  add column if not exists oculta_pelo_autor boolean not null default false;

grant update on public.atendimento_mensagens to authenticated;

drop policy if exists atendimento_mensagens_update on public.atendimento_mensagens;
create policy atendimento_mensagens_update
  on public.atendimento_mensagens
  for update
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

create or replace function public.atendimento_mensagens_update_guard()
returns trigger
language plpgsql
as $$
begin
  new.conversa_id := old.conversa_id;
  new.autor_id := old.autor_id;
  new.papel := old.papel;
  new.corpo := old.corpo;
  new.tipo := old.tipo;
  new.arquivo_path := old.arquivo_path;
  new.arquivo_nome := old.arquivo_nome;
  new.arquivo_mime := old.arquivo_mime;
  new.arquivo_tamanho := old.arquivo_tamanho;
  new.created_at := old.created_at;
  if old.oculta_pelo_autor then
    new.oculta_pelo_autor := true;
  end if;
  return new;
end;
$$;

drop trigger if exists atendimento_mensagens_before_upd on public.atendimento_mensagens;
create trigger atendimento_mensagens_before_upd
  before update on public.atendimento_mensagens
  for each row execute function public.atendimento_mensagens_update_guard();

revoke delete on public.atendimento_mensagens from authenticated;
drop policy if exists atendimento_mensagens_delete on public.atendimento_mensagens;

notify pgrst, 'reload schema';
