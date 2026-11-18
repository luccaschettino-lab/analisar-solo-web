-- Tutorial de primeiro acesso e fazenda de exemplo (2026-11-18).
--
-- 1) Progresso do tutorial no perfil da pessoa, para valer em qualquer
--    aparelho: { boasVindasEm, dicas: { tela: true }, passosFechadosEm }.
--    A política "perfis: atualizar o proprio" já deixa cada um gravar o seu.
alter table public.perfis
  add column if not exists tutorial jsonb not null default '{}'::jsonb;

-- 2) Marca da fazenda de exemplo (dados fictícios, criados pelo app na
--    conta da pessoa). O app mostra a faixa "dados fictícios" e deixa de
--    contar essa fazenda nos primeiros passos.
alter table public.fazendas
  add column if not exists exemplo boolean not null default false;
