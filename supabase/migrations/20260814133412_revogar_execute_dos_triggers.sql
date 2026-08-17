-- ============================================================
-- Fecha as funcoes de trigger para o mundo externo.
--
-- Apontado pelo linter do Supabase apos aplicar as migracoes:
-- toda funcao no schema public vira endpoint em /rest/v1/rpc/, e as
-- duas funcoes de trigger nasceram executaveis por anon e por
-- authenticated. Sao SECURITY DEFINER — rodam com privilegio de dono.
--
-- Na pratica o Postgres recusa a chamada ("trigger functions can only
-- be called as triggers"), entao nao havia exploracao possivel. Mas
-- funcao de trigger nao tem por que ser chamavel: o gatilho as invoca
-- por dentro, sem depender de GRANT.
--
-- As seis funcoes de autorizacao continuam executaveis por
-- authenticated de proposito: as policies de RLS sao avaliadas com as
-- permissoes de quem consulta, entao sem EXECUTE toda leitura falharia.
-- ============================================================

revoke execute on function
  public.criar_perfil_para_novo_usuario(),
  public.registrar_proprietario_fazenda()
from public, anon, authenticated;
