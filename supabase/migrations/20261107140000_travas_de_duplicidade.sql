-- O banco passa a recusar análise e ponto de coleta repetidos (auditoria de
-- 2026-11-07, P4). Até aqui só a tela evitava repetição, e duas abas, uma
-- lista cortada ou uma importação refeita gravavam tudo de novo.
--
-- Conferido antes de aplicar: nenhuma linha atual viola as travas.

-- Análise: a mesma identidade que a importação de laudo já usa
-- (lib/importacaoLaudo.js, chaveDeDuplicidade). Análise sem nº do laboratório
-- (lançada à mão) não entra na trava: no Postgres, nulo nunca é igual a nulo,
-- e um talhão tem várias amostras na mesma safra e profundidade.
alter table public.analises
  add constraint analises_talhao_safra_profundidade_numero_key
  unique (talhao_id, ano_safra, profundidade, numero_amostra_lab);

-- Ponto de coleta: o mesmo talhão não tem dois pontos na mesma coordenada.
-- A coordenada vira coluna gerada para a trava poder ser usada pela API
-- (upsert com on_conflict precisa de colunas, não de expressão).
alter table public.pontos_coleta
  add column coordenadas jsonb
  generated always as (geometria -> 'geometry' -> 'coordinates') stored;

alter table public.pontos_coleta
  add constraint pontos_coleta_talhao_coordenadas_key
  unique (talhao_id, coordenadas);

comment on column public.pontos_coleta.coordenadas is
  'Gerada de geometria (lng, lat). Existe para a trava unique (talhao_id, coordenadas): reimportar o mesmo arquivo não dobra os pontos.';
