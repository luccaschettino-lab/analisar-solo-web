-- ============================================================
-- Schema inicial: hierarquia Fazenda > Talhao > Gleba > Analise
--
-- Regra central do modelo: o numero da amostra do laboratorio NAO
-- identifica a gleba. Ele muda a cada coleta e vive em
-- analises.numero_amostra_lab, apenas como referencia ao laudo.
-- A identidade permanente e glebas.id, e e sobre ela que a
-- comparacao entre anos se apoia.
-- ============================================================

-- ------------------------------------------------------------
-- perfis: espelho de auth.users com os dados que a aplicacao le.
-- Preenchido por trigger no cadastro (ver migracao de triggers).
-- ------------------------------------------------------------
create table public.perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  email      text,
  criado_em  timestamptz not null default now()
);

comment on table public.perfis is
  'Dados de exibicao do usuario. auth.users nao e consultavel pelo cliente.';

-- ------------------------------------------------------------
-- fazendas
-- ------------------------------------------------------------
create table public.fazendas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  municipio   text,
  uf          text,
  centro_lat  numeric,
  centro_lng  numeric,
  -- default auth.uid(): o cliente nunca precisa mandar esta coluna, e a
  -- policy de insert consegue exigir que ela seja o proprio usuario.
  criado_por  uuid references auth.users(id) default auth.uid(),
  criado_em   timestamptz not null default now()
);

comment on column public.fazendas.centro_lat is
  'Centro do mapa na abertura da fazenda. Nao e centroide calculado.';

-- ------------------------------------------------------------
-- fazenda_membros: quem acessa cada fazenda e com qual papel.
-- Base do compartilhamento com agronomo/consultor e fonte de
-- verdade de toda a RLS da hierarquia.
-- ------------------------------------------------------------
create table public.fazenda_membros (
  fazenda_id  uuid not null references public.fazendas(id) on delete cascade,
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  papel       text not null default 'proprietario'
              check (papel in ('proprietario','editor','leitor')),
  criado_em   timestamptz not null default now(),
  primary key (fazenda_id, usuario_id)
);

-- A PK ja cobre buscas por fazenda_id; este indice cobre o caminho
-- inverso, "todas as fazendas deste usuario", usado no painel.
create index fazenda_membros_usuario_idx on public.fazenda_membros (usuario_id);

-- ------------------------------------------------------------
-- talhoes: subdivisao da fazenda. codigo = coluna "Lote" do laudo.
-- ------------------------------------------------------------
create table public.talhoes (
  id          uuid primary key default gen_random_uuid(),
  fazenda_id  uuid not null references public.fazendas(id) on delete cascade,
  codigo      text not null,
  nome        text,
  -- Feature GeoJSON (Polygon ou MultiPolygon) desenhada no mapa.
  geometria   jsonb,
  -- Calculada no cliente com turf no momento de salvar. Guardada para
  -- nao recalcular a cada leitura e para permitir ordenar/somar no banco.
  area_ha     numeric,
  cor         text not null default '#2e7d32',
  criado_em   timestamptz not null default now(),
  unique (fazenda_id, codigo)
);

create index talhoes_fazenda_idx on public.talhoes (fazenda_id);

comment on column public.talhoes.codigo is
  'Corresponde a coluna Lote das planilhas de laboratorio (ex: 8, 12, 18).';

-- ------------------------------------------------------------
-- glebas: ponto ou micro-area de coleta dentro do talhao.
-- codigo = coluna "Amostra", mas definido pelo usuario e ESTAVEL
-- entre safras. O numero que o laboratorio usa fica na analise.
-- ------------------------------------------------------------
create table public.glebas (
  id         uuid primary key default gen_random_uuid(),
  talhao_id  uuid not null references public.talhoes(id) on delete cascade,
  codigo     text not null,
  nome       text,
  -- Point (ponto de coleta) ou Polygon (sub-area), escolha do usuario.
  geometria  jsonb,
  area_ha    numeric,
  criado_em  timestamptz not null default now(),
  unique (talhao_id, codigo)
);

create index glebas_talhao_idx on public.glebas (talhao_id);

comment on table public.glebas is
  'Entidade cadastral permanente. A comparacao entre anos usa glebas.id, '
  'nunca o numero de amostra do laudo.';

-- ------------------------------------------------------------
-- analises: um laudo, para uma gleba, em um ano-safra e uma
-- profundidade. Todos os parametros sao anulaveis: laudos chegam
-- incompletos, e a camada 20-40 costuma vir sem micronutrientes.
-- ------------------------------------------------------------
create table public.analises (
  id                 uuid primary key default gen_random_uuid(),
  gleba_id           uuid not null references public.glebas(id) on delete cascade,
  -- Formato "25-26". O check evita que se misturem "2025/26" e "25-26"
  -- na mesma base, o que quebraria o agrupamento por safra.
  ano_safra          text not null check (ano_safra ~ '^\d{2}-\d{2}$'),
  data_coleta        date,
  profundidade       text not null
                     check (profundidade in ('0-20','20-40','40-60','outro')),
  laboratorio        text,
  -- Referencia ao laudo daquele ano. NAO e identidade da gleba.
  numero_amostra_lab text,
  observacoes        text,
  origem             text not null default 'manual'
                     check (origem in ('manual','pdf','importacao')),
  criado_por         uuid references auth.users(id) default auth.uid(),
  criado_em          timestamptz not null default now(),

  -- Granulometria (%)
  cascalho      numeric,
  areia         numeric,
  silte         numeric,
  argila        numeric,

  -- Complexo sortivo e acidez
  ph_h2o        numeric,  -- -
  p             numeric,  -- mg/dm3
  k             numeric,  -- mg/dm3
  ca            numeric,  -- cmolc/dm3
  mg            numeric,  -- cmolc/dm3
  al            numeric,  -- cmolc/dm3
  h_al          numeric,  -- cmolc/dm3
  sb            numeric,  -- cmolc/dm3
  t_efetiva     numeric,  -- cmolc/dm3  (t minusculo no laudo)
  t_potencial   numeric,  -- cmolc/dm3  (T maiusculo no laudo)
  v             numeric,  -- %
  m             numeric,  -- %
  mo            numeric,  -- dag/kg
  p_rem         numeric,  -- mg/L

  -- Enxofre e micronutrientes (mg/dm3)
  s             numeric,
  b             numeric,
  cu            numeric,
  mn            numeric,
  fe            numeric,
  zn            numeric,

  -- Parametros de laboratorios que fujam da lista acima.
  extras        jsonb not null default '{}'::jsonb,

  -- Chave natural do laudo.
  unique (gleba_id, ano_safra, profundidade)
);

create index analises_gleba_idx on public.analises (gleba_id);
-- Suporta o comparativo entre safras de uma mesma profundidade.
create index analises_safra_idx on public.analises (ano_safra, profundidade);

comment on column public.analises.numero_amostra_lab is
  'Numero impresso no laudo. O laboratorio renumera a cada coleta, '
  'entao serve so como referencia — nunca para identificar a gleba.';

comment on column public.analises.extras is
  'Parametros fora da lista fixa. Unidades ficam no front '
  '(src/config/parametros.js), nunca no banco.';
