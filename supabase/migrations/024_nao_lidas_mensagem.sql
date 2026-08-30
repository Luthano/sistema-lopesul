-- O guard da conversa desfazia preview e não lidas no envio.
-- O trigger interno precisa atravessar o guard.

create or replace function public.atendimento_apos_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preview_txt text;
  rotulo text;
  texto text;
begin
  perform set_config('lopesul.atendimento_interno', 'on', true);
  new.corpo := trim(regexp_replace(coalesce(new.corpo, ''), '\s+', ' ', 'g'));
  new.tipo := coalesce(nullif(trim(new.tipo), ''), 'texto');

  texto := new.corpo;
  if new.arquivo_path is null then
    preview_txt := left(texto, 140);
  else
    rotulo := case new.tipo
      when 'imagem' then 'Imagem'
      when 'audio' then 'Áudio'
      when 'video' then 'Vídeo'
      else 'Documento'
    end;
    preview_txt := case
      when texto <> '' then left(rotulo || ' · ' || texto, 140)
      else rotulo
    end;
  end if;

  update public.atendimento_conversas
  set
    status = 'aberta',
    ultima_mensagem_at = coalesce(new.created_at, now()),
    preview = preview_txt,
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

notify pgrst, 'reload schema';
