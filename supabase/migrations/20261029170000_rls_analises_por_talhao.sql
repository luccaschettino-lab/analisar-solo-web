-- ------------------------------------------------------------
-- Policies de analises passam a resolver a fazenda pelo TALHÃO.
--
-- A migração 20260908171034 fez a análise pertencer ao talhão (talhao_id
-- obrigatório) e deixou gleba_id opcional — o app nem lê nem grava mais esse
-- campo. Mas as policies continuaram perguntando "a fazenda da GLEBA é sua?":
-- com gleba_id nulo, fazenda_da_gleba() devolve nulo, tem_acesso_fazenda(nulo)
-- é falso, e a análise some para todo mundo (e o insert do app, que não manda
-- gleba_id, é recusado).
--
-- ALTER POLICY troca a regra no lugar, sem janela em que a tabela fique sem
-- policy (com RLS ligada e nenhuma policy, ninguém lê nada). As mesmas
-- funções de autorização das outras tabelas: ler = qualquer membro;
-- escrever = proprietário ou editor.
-- ------------------------------------------------------------

alter policy "analises: ler" on public.analises
  using (public.tem_acesso_fazenda(public.fazenda_do_talhao(talhao_id)));

alter policy "analises: criar" on public.analises
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

-- with check = onde a linha pode parar depois: impede "mover" a análise para
-- um talhão de uma fazenda em que o usuário não escreve.
alter policy "analises: editar" on public.analises
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)))
  with check (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));

alter policy "analises: apagar" on public.analises
  using (public.pode_editar_fazenda(public.fazenda_do_talhao(talhao_id)));
