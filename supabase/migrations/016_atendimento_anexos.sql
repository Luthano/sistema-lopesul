-- Anexos do chat de atendimento (imagem, áudio, vídeo e documentos)

alter table public.atendimento_mensagens
  add column if not exists tipo text not null default 'texto';

alter table public.atendimento_mensagens
  add column if not exists arquivo_path text;

alter table public.atendimento_mensagens
  add column if not exists arquivo_nome text;

alter table public.atendimento_mensagens
  add column if not exists arquivo_mime text;

alter table public.atendimento_mensagens
  add column if not exists arquivo_tamanho integer;

alter table public.atendimento_mensagens
  drop constraint if exists atendimento_mensagens_tipo_check;

alter table public.atendimento_mensagens
  add constraint atendimento_mensagens_tipo_check
  check (tipo in ('texto', 'imagem', 'audio', 'video', 'documento'));

alter table public.atendimento_mensagens
  drop constraint if exists atendimento_mensagens_corpo_check;

alter table public.atendimento_mensagens
  add constraint atendimento_mensagens_corpo_check
  check (
    (
      arquivo_path is not null
      and char_length(trim(coalesce(corpo, ''))) <= 2000
    )
    or (
      arquivo_path is null
      and char_length(trim(coalesce(corpo, ''))) between 1 and 2000
    )
  );

alter table public.atendimento_mensagens
  drop constraint if exists atendimento_mensagens_arquivo_check;

alter table public.atendimento_mensagens
  add constraint atendimento_mensagens_arquivo_check
  check (
    (tipo = 'texto' and arquivo_path is null)
    or (
      tipo <> 'texto'
      and arquivo_path is not null
      and char_length(arquivo_path) between 1 and 500
    )
  );

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
      and (c.cliente_id = auth.uid() or public.is_master())
  );
$$;

grant execute on function public.atendimento_pode_usar_pasta(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('atendimento', 'atendimento', false, 52428800)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists atendimento_arquivos_select on storage.objects;
drop policy if exists atendimento_arquivos_insert on storage.objects;

create policy atendimento_arquivos_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'atendimento'
    and public.atendimento_pode_usar_pasta(name)
  );

create policy atendimento_arquivos_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'atendimento'
    and public.atendimento_pode_usar_pasta(name)
  );

notify pgrst, 'reload schema';
