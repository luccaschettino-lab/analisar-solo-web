-- ============================================================
-- Monitoramento de pragas, doenças e plantas daninhas + cargo Monitor
-- (2026-11-19).
--
-- Cargo Monitor: quem vai a campo. Vê tudo da fazenda (como o Leitor) e
-- lança vistorias de pragas e laudos (análises). Não desenha talhões nem
-- glebas, não mexe em critérios nem na equipe.
--
-- Vistoria: uma ida ao talhão numa data. Cada registro é o que se achou num
-- ponto (coordenada do GPS): uma praga com o valor medido, ou "nada
-- encontrado" (praga nula), que conta como zero na média do talhão.
--
-- A lista de pragas e os níveis de controle de referência ficam no código
-- (src/config/pragas.js). `pragas_da_fazenda` guarda só o que a fazenda
-- mudou ou acrescentou: mesma `chave` substitui a de referência.
-- ============================================================

-- ---------- Cargo Monitor ----------
alter table public.fazenda_membros drop constraint if exists fazenda_membros_papel_check;
alter table public.fazenda_membros
  add constraint fazenda_membros_papel_check
  check (papel in ('proprietario', 'agronomo', 'editor', 'monitor', 'leitor'));

alter table public.fazenda_convites drop constraint if exists fazenda_convites_papel_check;
alter table public.fazenda_convites
  add constraint fazenda_convites_papel_check
  check (papel in ('proprietario', 'agronomo', 'editor', 'monitor', 'leitor'));

-- Quem lança o que vem do campo: laudos e vistorias.
create or replace function public.pode_lancar_campo(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.papel_na_fazenda(f_id) in ('proprietario', 'agronomo', 'editor', 'monitor'), false)
$$;

revoke execute on function public.pode_lancar_campo(uuid) from public, anon;
grant execute on function public.pode_lancar_campo(uuid) to authenticated;

-- Análises (laudos): o Monitor também lança, corrige e apaga.
alter policy "analises: criar" on public.analises
  with check (public.pode_lancar_campo(public.fazenda_do_talhao(talhao_id)));
alter policy "analises: editar" on public.analises
  using (public.pode_lancar_campo(public.fazenda_do_talhao(talhao_id)))
  with check (public.pode_lancar_campo(public.fazenda_do_talhao(talhao_id)));
alter policy "analises: apagar" on public.analises
  using (public.pode_lancar_campo(public.fazenda_do_talhao(talhao_id)));

-- Fotos: o Monitor envia e apaga só na pasta das vistorias
-- (fazenda_id/pragas/...). O resto continua com quem edita a fazenda.
alter policy "fotos: enviar se proprietario ou editor" on storage.objects
  with check (
    bucket_id = 'fotos' and (
      public.pode_editar_fazenda(public.uuid_ou_nulo((storage.foldername(name))[1]))
      or ((storage.foldername(name))[2] = 'pragas'
          and public.pode_lancar_campo(public.uuid_ou_nulo((storage.foldername(name))[1])))
    )
  );
alter policy "fotos: apagar se proprietario ou editor" on storage.objects
  using (
    bucket_id = 'fotos' and (
      public.pode_editar_fazenda(public.uuid_ou_nulo((storage.foldername(name))[1]))
      or ((storage.foldername(name))[2] = 'pragas'
          and public.pode_lancar_campo(public.uuid_ou_nulo((storage.foldername(name))[1])))
    )
  );

-- A lista da equipe na ordem dos cargos.
create or replace function public.equipe_da_fazenda(f_id uuid)
returns table (usuario_id uuid, nome text, email text, papel text, desde timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select fm.usuario_id, p.nome, p.email, fm.papel, fm.criado_em
  from public.fazenda_membros fm
  left join public.perfis p on p.id = fm.usuario_id
  where fm.fazenda_id = f_id
    and public.e_proprietario_fazenda(f_id)
  order by case fm.papel when 'proprietario' then 0 when 'agronomo' then 1 when 'editor' then 2
                         when 'monitor' then 3 else 4 end,
           coalesce(p.nome, p.email)
$$;

-- ---------- Vistorias ----------
create table public.vistorias (
  id          uuid primary key default gen_random_uuid(),
  talhao_id   uuid not null references public.talhoes(id) on delete cascade,
  data        date not null default current_date,
  cultura     text not null check (cultura in ('soja', 'cafe')),
  -- V4, R3, florada, chumbinho… (texto livre curto)
  estadio     text check (estadio is null or char_length(estadio) <= 30),
  observacao  text check (observacao is null or char_length(observacao) <= 1000),
  criado_por  uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em   timestamptz not null default now()
);

comment on table public.vistorias is
  'Ida a campo num talhão, numa data, para monitorar pragas, doenças e plantas daninhas.';

create index vistorias_talhao_idx on public.vistorias (talhao_id, data desc);
create index vistorias_criado_por_idx on public.vistorias (criado_por);

create table public.vistoria_registros (
  id          uuid primary key default gen_random_uuid(),
  vistoria_id uuid not null references public.vistorias(id) on delete cascade,
  -- Número do ponto na vistoria: vários registros (pragas) no mesmo ponto.
  ponto       smallint not null check (ponto between 1 and 9999),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  -- Chave da praga (da lista de referência ou da fazenda). Nula = ponto
  -- vistoriado sem nada encontrado.
  praga       text check (praga is null or char_length(praga) <= 60),
  -- pano: insetos (valor) em metros de pano (amostra) → por metro
  -- contagem: atacados (valor) de quantos olhados (amostra) → %
  -- percentual: % estimada (desfolha, incidência)
  -- presenca: 1 achou, 0 não
  -- nota: 1 baixo, 2 médio, 3 alto
  metodo      text check (metodo is null or metodo in ('pano', 'contagem', 'percentual', 'presenca', 'nota')),
  valor       numeric check (valor is null or valor >= 0),
  amostra     numeric check (amostra is null or amostra > 0),
  foto        text check (foto is null or char_length(foto) <= 300),
  observacao  text check (observacao is null or char_length(observacao) <= 500),
  criado_por  uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em   timestamptz not null default now(),
  check ((praga is null) = (metodo is null)),
  check (praga is null or valor is not null),
  check (metodo is distinct from 'percentual' or valor <= 100),
  check (metodo is distinct from 'presenca' or valor in (0, 1)),
  check (metodo is distinct from 'nota' or valor in (1, 2, 3)),
  check (metodo is distinct from 'contagem' or (amostra is not null and valor <= amostra))
);

comment on table public.vistoria_registros is
  'O que se achou em cada ponto de uma vistoria: uma praga e o valor medido, ou nada (praga nula).';

create index vistoria_registros_vistoria_idx on public.vistoria_registros (vistoria_id);
create index vistoria_registros_criado_por_idx on public.vistoria_registros (criado_por);

create or replace function public.fazenda_da_vistoria(v_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.fazenda_id from public.vistorias v join public.talhoes t on t.id = v.talhao_id where v.id = v_id
$$;

revoke execute on function public.fazenda_da_vistoria(uuid) from public, anon;
grant execute on function public.fazenda_da_vistoria(uuid) to authenticated;

alter table public.vistorias enable row level security;
alter table public.vistoria_registros enable row level security;

create policy "vistorias: ler" on public.vistorias for select to authenticated
  using (public.tem_acesso_fazenda(public.fazenda_do_talhao(talhao_id)));
create policy "vistorias: criar" on public.vistorias for insert to authenticated
  with check (public.pode_lancar_campo(public.fazenda_do_talhao(talhao_id)));
create policy "vistorias: editar" on public.vistorias for update to authenticated
  using (public.pode_lancar_campo(public.fazenda_do_talhao(talhao_id)))
  with check (public.pode_lancar_campo(public.fazenda_do_talhao(talhao_id)));
create policy "vistorias: apagar" on public.vistorias for delete to authenticated
  using (public.pode_lancar_campo(public.fazenda_do_talhao(talhao_id)));

create policy "registros: ler" on public.vistoria_registros for select to authenticated
  using (public.tem_acesso_fazenda(public.fazenda_da_vistoria(vistoria_id)));
create policy "registros: criar" on public.vistoria_registros for insert to authenticated
  with check (public.pode_lancar_campo(public.fazenda_da_vistoria(vistoria_id)));
create policy "registros: editar" on public.vistoria_registros for update to authenticated
  using (public.pode_lancar_campo(public.fazenda_da_vistoria(vistoria_id)))
  with check (public.pode_lancar_campo(public.fazenda_da_vistoria(vistoria_id)));
create policy "registros: apagar" on public.vistoria_registros for delete to authenticated
  using (public.pode_lancar_campo(public.fazenda_da_vistoria(vistoria_id)));

revoke all on public.vistorias, public.vistoria_registros from anon;
grant select, insert, update, delete on public.vistorias, public.vistoria_registros to authenticated;

-- ---------- Lista de pragas da fazenda (ajustes) ----------
create table public.pragas_da_fazenda (
  fazenda_id  uuid not null references public.fazendas(id) on delete cascade,
  chave       text not null check (chave ~ '^[a-z0-9-]{1,60}$'),
  cultura     text not null check (cultura in ('soja', 'cafe')),
  tipo        text not null check (tipo in ('praga', 'doenca', 'daninha')),
  nome        text not null check (char_length(nome) between 1 and 80),
  metodo      text not null check (metodo in ('pano', 'contagem', 'percentual', 'presenca', 'nota')),
  -- Nível de controle no método acima (nulo = sem nível: só registra).
  controle    numeric check (controle is null or controle >= 0),
  -- Na fase reprodutiva da soja (R1 em diante), se for diferente.
  controle_reprodutivo numeric check (controle_reprodutivo is null or controle_reprodutivo >= 0),
  ativa       boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (fazenda_id, chave)
);

comment on table public.pragas_da_fazenda is
  'Pragas acrescentadas pela fazenda e níveis de controle ajustados (a mesma chave substitui a da lista de referência do app).';

create index pragas_da_fazenda_atualizado_por_idx on public.pragas_da_fazenda (atualizado_por);

alter table public.pragas_da_fazenda enable row level security;

create policy "pragas da fazenda: ler" on public.pragas_da_fazenda for select to authenticated
  using (public.tem_acesso_fazenda(fazenda_id));
create policy "pragas da fazenda: criar" on public.pragas_da_fazenda for insert to authenticated
  with check (public.pode_definir_criterio(fazenda_id));
create policy "pragas da fazenda: editar" on public.pragas_da_fazenda for update to authenticated
  using (public.pode_definir_criterio(fazenda_id))
  with check (public.pode_definir_criterio(fazenda_id));
create policy "pragas da fazenda: apagar" on public.pragas_da_fazenda for delete to authenticated
  using (public.pode_definir_criterio(fazenda_id));

revoke all on public.pragas_da_fazenda from anon;
grant select, insert, update, delete on public.pragas_da_fazenda to authenticated;
