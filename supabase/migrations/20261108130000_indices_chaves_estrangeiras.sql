-- Índices que faltavam em chaves estrangeiras (auditoria de 2026-11-07, P19;
-- aviso "unindexed foreign keys" do Supabase).
--
-- analises.talhao_id é a coluna mais filtrada do sistema (mapa, tela do
-- talhão, regra de acesso de cada análise) e não tinha índice: o único era o
-- da coluna antiga, analises_gleba_idx. Com 113 linhas não se nota; com
-- várias safras, cada abertura do mapa varreria a tabela inteira.
--
-- criado_por (análises e fazendas): sem índice, apagar um usuário obriga o
-- banco a varrer as duas tabelas para conferir a chave estrangeira.

create index if not exists analises_talhao_idx on public.analises (talhao_id);
create index if not exists analises_criado_por_idx on public.analises (criado_por);
create index if not exists fazendas_criado_por_idx on public.fazendas (criado_por);
