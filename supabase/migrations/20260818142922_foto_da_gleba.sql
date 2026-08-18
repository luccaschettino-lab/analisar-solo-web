-- ============================================================
-- Foto do solo, uma por gleba
--
-- Primeiro uso de Storage no projeto. A ideia central e nao inventar
-- autorizacao nova: o caminho do arquivo comeca pelo fazenda_id, e as
-- policies do bucket chamam as MESMAS funcoes que governam o resto —
-- tem_acesso_fazenda para ver, pode_editar_fazenda para mexer.
--
-- Caminho: fazenda_id/gleba_id/uuid.jpg
--   - fazenda_id na frente: e o que a policy le, com storage.foldername
--   - uuid no fim: substituir a foto gera um caminho novo, entao o
--     navegador nao mostra a antiga vinda do cache
-- ============================================================

-- ------------------------------------------------------------
-- glebas: o ponteiro para o arquivo
--
-- Uma foto por gleba, substituivel. Nao e tabela separada porque nao ha
-- galeria: a segunda foto toma o lugar da primeira.
-- ------------------------------------------------------------
alter table public.glebas
  add column foto_path text,
  add column foto_em   timestamptz;

comment on column public.glebas.foto_path is
  'Caminho no bucket `fotos`, no formato fazenda_id/gleba_id/uuid.jpg. Null = gleba sem foto.';

comment on column public.glebas.foto_em is
  'Quando a foto atual foi enviada. Sem isso, uma foto de tres anos atras se passa por retrato de hoje.';

-- ------------------------------------------------------------
-- Bucket privado
--
-- Foto do solo e dado da propriedade. O .gitignore ja bloqueia planilhas
-- e laudos pelo mesmo motivo; bucket publico seria a mesma exposicao por
-- outra porta. O acesso sai por URL assinada, de validade curta.
--
-- O limite de tamanho e rede de seguranca, nao o mecanismo: o navegador
-- reduz a foto para ~300 KB antes de subir. Mas o servidor nao deve
-- confiar no cliente para isso.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Cast seguro de texto para uuid
--
-- `(storage.foldername(name))[1]::uuid` estoura com 22P02 se alguem
-- gravar em um caminho que nao comece por um uuid. Numa policy, erro e
-- pior que negacao: quebra a consulta inteira em vez de esconder a
-- linha. Esta funcao devolve null nesse caso, e null derruba
-- tem_acesso_fazenda como deve.
-- ------------------------------------------------------------
create or replace function public.uuid_ou_nulo(texto text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return texto::uuid;
exception
  when others then return null;
end;
$$;

revoke execute on function public.uuid_ou_nulo(text) from public, anon;
grant execute on function public.uuid_ou_nulo(text) to authenticated;

-- ------------------------------------------------------------
-- Policies do bucket
--
-- storage.objects ja nasce com RLS habilitada no Supabase. As quatro
-- policies abaixo valem so para o bucket `fotos`; os demais buckets
-- (nenhum, hoje) seguem com as regras deles.
--
-- A fazenda sai do primeiro segmento do caminho. Quem tenta gravar fora
-- do proprio fazenda_id nao passa no with check, porque a funcao de
-- autorizacao vai olhar uma fazenda em que ele nao escreve.
-- ------------------------------------------------------------
create policy "fotos: ver quem acessa a fazenda"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos'
    and public.tem_acesso_fazenda(public.uuid_ou_nulo((storage.foldername(name))[1]))
  );

create policy "fotos: enviar se proprietario ou editor"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and public.pode_editar_fazenda(public.uuid_ou_nulo((storage.foldername(name))[1]))
  );

-- Update existe para o caso de sobrescrita no mesmo caminho. O app nao
-- faz isso — troca o uuid a cada envio —, mas deixar so insert e delete
-- criaria uma pegadinha para quem mexer aqui depois.
create policy "fotos: substituir se proprietario ou editor"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'fotos'
    and public.pode_editar_fazenda(public.uuid_ou_nulo((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'fotos'
    and public.pode_editar_fazenda(public.uuid_ou_nulo((storage.foldername(name))[1]))
  );

create policy "fotos: apagar se proprietario ou editor"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos'
    and public.pode_editar_fazenda(public.uuid_ou_nulo((storage.foldername(name))[1]))
  );
