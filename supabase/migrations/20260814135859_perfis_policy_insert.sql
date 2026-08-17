-- Permite que o usuario recrie o proprio perfil.
-- O trigger ao_criar_usuario so dispara no cadastro, que acontece uma vez.
-- Sem esta policy, um perfil perdido e irrecuperavel pelo proprio dono.
--
-- Continua sem policy de delete: a linha morre por cascade de auth.users,
-- e apagar o proprio perfil mantendo a conta viva nao e um caso de uso.
create policy "perfis: criar o proprio"
  on public.perfis for insert to authenticated
  with check (id = (select auth.uid()));
