-- ============================================================
-- centro_lat/centro_lng -> sede_lat/sede_lng
--
-- O ponto gravado era "onde o mapa abre": detalhe de interface, sem
-- representacao na tela. Ele passa a ser a SEDE da fazenda — um lugar
-- real, que o produtor reconhece, marcado com pin e nome no mapa.
--
-- O enquadramento de abertura continua caindo nele quando nao ha
-- talhao desenhado, mas isso virou consequencia, nao a definicao.
--
-- Rename e nao coluna nova: manter `centro_lat` guardando a sede faria
-- a coluna mentir sobre o que guarda, e o projeto trata nome de dominio
-- como parte do modelo. O custo e que o bundle publicado quebra ate o
-- novo subir — por isso esta migracao e aplicada colada ao deploy.
-- ============================================================

alter table public.fazendas rename column centro_lat to sede_lat;
alter table public.fazendas rename column centro_lng to sede_lng;

comment on column public.fazendas.sede_lat is
  'Latitude da sede da fazenda, marcada pelo usuario no mapa. Aparece como pin com o nome da fazenda, e serve de enquadramento de abertura quando nao ha talhao desenhado.';

comment on column public.fazendas.sede_lng is
  'Longitude da sede. Ver sede_lat.';
