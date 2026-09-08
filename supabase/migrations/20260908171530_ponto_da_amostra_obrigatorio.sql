-- Ponto de coleta de cada amostra, pra desenhar mapa de calor por talhao em
-- vez de uma cor solida por gleba. Ja preenchido nas 139 analises existentes
-- (centroide da gleba historica de cada uma); daqui pra frente e obrigatorio
-- marcar o ponto ao lancar uma amostra nova.

alter table analises
  alter column geometria set not null;

comment on column analises.geometria is
  'Ponto (GeoJSON Feature/Point) de onde a amostra foi coletada dentro do talhao. Usado pra desenhar o mapa de calor - varias amostras do mesmo talhao/safra/profundidade se distinguem por este ponto, nao por qual gleba (obsoleta) elas vieram.';
