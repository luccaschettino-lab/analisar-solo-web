-- ============================================================
-- criterios.autor_nome
--
-- A legenda do mapa precisa assinar o criterio: "as cores desta tela
-- seguem o conjunto X, de Fulano". Sem isso a cor volta a ser uma
-- afirmacao anonima sobre a terra de alguem, que e exatamente o que
-- esta fase existe para consertar.
--
-- Por que denormalizar em vez de ler `perfis` na hora:
-- a policy de perfis e "ler o proprio" — de proposito. O produtor nao
-- enxerga o perfil do consultor, e afrouxar aquela policy para exibir
-- um nome abriria a leitura de todos os perfis do sistema. Gravar o
-- nome aqui resolve sem mexer em quem ve o que.
--
-- E um retrato do momento da criacao: se a pessoa mudar o proprio nome
-- depois, os conjuntos antigos seguem com o nome antigo. Para uma
-- assinatura isso e aceitavel, e ate desejavel — quem assinou, assinou
-- com o nome daquele dia.
-- ============================================================

alter table public.criterios add column autor_nome text;

comment on column public.criterios.autor_nome is
  'Nome do autor no momento da criacao, copiado de perfis pelo trigger. Denormalizado porque a policy de perfis e "ler o proprio" e o produtor precisa ver de quem e o criterio aplicado a fazenda dele.';

create or replace function public.preencher_autor_do_criterio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- coalesce em cascata: o nome do perfil, o e-mail como segunda opcao,
  -- e nada se nem isso houver. Assinatura vazia e melhor que assinatura
  -- inventada.
  select coalesce(p.nome, p.email)
    into new.autor_nome
  from public.perfis p
  where p.id = new.criado_por;

  return new;
end;
$$;

revoke execute on function public.preencher_autor_do_criterio() from public, anon, authenticated;

create trigger criterios_autor_nome
  before insert on public.criterios
  for each row execute function public.preencher_autor_do_criterio();
