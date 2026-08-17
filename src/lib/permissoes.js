// Espelha as policies de RLS do banco. O servidor e quem decide de verdade;
// isto existe so para a interface nao oferecer um botao que vai falhar.
// Se mudar aqui, mude tambem em supabase/migrations/*_rls.sql.

export function podeEditar(papel) {
  return papel === 'proprietario' || papel === 'editor'
}

export function ehProprietario(papel) {
  return papel === 'proprietario'
}

export const ROTULO_PAPEL = {
  proprietario: 'Proprietário',
  editor: 'Editor',
  leitor: 'Leitor',
}
