-- Limpeza (auditoria de 2026-11-07, P14).
--
-- 1) analises.gleba_id sai.
--    Era o vínculo da época em que a amostra pertencia à gleba; desde
--    `amostra_passa_a_ser_do_talhao` a análise é do talhão e o app não grava
--    mais esta coluna. Conferido antes: 0 das 113 análises com valor, e nada
--    no banco (view, política, função) depende dela. O único uso no app era
--    contar "análises que serão apagadas" ao excluir uma gleba, o que estava
--    errado: a chave era `on delete set null`, a análise nunca ia junto.
--    Sai também o índice analises_gleba_idx e a chave estrangeira.
alter table public.analises drop column if exists gleba_id;

-- 2) Ponto de coleta: ao CRIAR, a gleba informada também tem de ser do mesmo
--    talhão do ponto. A regra de EDITAR já conferia isso
--    (`vincular_pontos_coleta_a_glebas`); a de criar só conferia o talhão.
alter policy "pontos de coleta: criar" on public.pontos_coleta
  with check (
    public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id))
    and (gleba_id is null or public.talhao_da_gleba(gleba_id) = talhao_id)
  );
