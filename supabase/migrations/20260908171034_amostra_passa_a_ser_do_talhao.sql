-- Amostra passa a ser do talhao, nao mais da gleba. Gleba fica de fora da
-- jogada por ora - dado historico intacto, tabela nao e apagada. So muda
-- pra onde a analise aponta dai pra frente.

alter table analises
  add column talhao_id uuid references talhoes(id) on delete cascade;

update analises a
set talhao_id = g.talhao_id
from glebas g
where a.gleba_id = g.id;

alter table analises
  alter column talhao_id set not null;

-- Gleba era a chave de unicidade quando so ela podia ter uma analise por
-- safra/profundidade. Um talhao tem varios pontos de amostra ao mesmo tempo,
-- entao nao ha mais uma chave de negocio unica aqui - so o id da linha.
alter table analises
  drop constraint analises_gleba_id_ano_safra_profundidade_key;

alter table analises
  alter column gleba_id drop not null;

-- CASCADE fazia sentido quando a gleba era a dona da analise. Agora, com a
-- gleba so como referencia historica, apagar uma gleba antiga nao pode
-- arrastar analise nenhuma - a dona de verdade e o talhao.
alter table analises
  drop constraint analises_gleba_id_fkey;

alter table analises
  add constraint analises_gleba_id_fkey foreign key (gleba_id) references glebas(id) on delete set null;

comment on column analises.talhao_id is
  'Talhao dono da amostra. Cada ponto de coleta e uma linha propria - um talhao com varios pontos de amostra tem varias analises na mesma safra/profundidade, de proposito.';

comment on column analises.gleba_id is
  'Historico: de quando a amostra pertencia a uma gleba, antes da fase em que gleba saiu de uso (mantida como cadastro, nao apagada). Nulo em analises lancadas depois dessa mudanca. O app nao le nem grava mais este campo.';
