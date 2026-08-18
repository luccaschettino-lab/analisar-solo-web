-- ============================================================
-- criterio_do_usuario nao precisa de EXECUTE para authenticated.
--
-- Ela e chamada de um unico lugar: de dentro de
-- validar_criterio_da_fazenda, que e SECURITY DEFINER e portanto roda
-- como dona da funcao. A permissao de quem disparou o update nao entra
-- na conta. O grant foi concedido por simetria com
-- criterio_em_fazenda_acessivel, que e outro caso — essa sim e avaliada
-- dentro de uma policy de RLS, com a permissao de quem consulta, e
-- precisa do grant.
--
-- Mesma licao da migracao 20260814133412: funcao SECURITY DEFINER com
-- EXECUTE para authenticated fica exposta em /rest/v1/rpc/.
-- ============================================================

revoke execute on function public.criterio_do_usuario(uuid) from authenticated;
