// Espelha as policies de RLS do banco. O servidor e quem decide de verdade;
// isto existe so para a interface nao oferecer um botao que vai falhar.
// Se mudar aqui, mude tambem em supabase/migrations (pode_editar_fazenda,
// pode_definir_criterio, pode_lancar_campo, e_proprietario_fazenda).

export function podeEditar(papel) {
  return papel === 'proprietario' || papel === 'agronomo' || papel === 'editor'
}

/** Lançar o que vem do campo: laudos (análises) e vistorias de pragas. */
export function podeLancarCampo(papel) {
  return podeEditar(papel) || papel === 'monitor'
}

/** Escolher ou tirar o critério de interpretação da fazenda. */
export function podeDefinirCriterio(papel) {
  return papel === 'proprietario' || papel === 'agronomo'
}

export function ehProprietario(papel) {
  return papel === 'proprietario'
}

export const ROTULO_PAPEL = {
  proprietario: 'Proprietário',
  agronomo: 'Agrônomo',
  editor: 'Editor',
  monitor: 'Monitor',
  leitor: 'Leitor',
}

/** Os cargos, na ordem de mais para menos acesso, com o que cada um faz. */
export const CARGOS = [
  { papel: 'proprietario', rotulo: 'Proprietário', faz: 'Tudo, inclusive convidar pessoas, mudar cargos e excluir a fazenda.' },
  { papel: 'agronomo', rotulo: 'Agrônomo', faz: 'Edita tudo e define os critérios e os níveis de controle de pragas. Não mexe na equipe.' },
  { papel: 'editor', rotulo: 'Editor', faz: 'Lança análises e vistorias, desenha talhões e glebas, sobe fotos. Não mexe em critérios.' },
  { papel: 'monitor', rotulo: 'Monitor', faz: 'Vai a campo: lança vistorias de pragas e laudos. Não desenha talhões nem glebas.' },
  { papel: 'leitor', rotulo: 'Leitor', faz: 'Só vê e exporta. Não altera nada.' },
]
