import { CHAVES_PARAMETROS } from '../config/parametros.js'
import { paraNumeroOuNulo } from './numeros.js'

/**
 * Monta o payload a partir dos valores do formulário (ou de um laudo lido).
 *
 * Todo parâmetro ausente entra como `null` explícito, não como campo omitido:
 * numa edição, omitir a chave deixaria o valor antigo no banco, e apagar um
 * número digitado por engano ficaria impossível.
 *
 * Fica aqui, e não em `dados/analises.js`, para quem monta payload sem gravar
 * (a importação de laudo, os testes) não carregar o cliente do Supabase.
 */
export function montarPayload({
  talhaoId,
  geometria,
  anoSafra,
  profundidade,
  dataColeta,
  laboratorio,
  numeroAmostraLab,
  observacoes,
  valores = {},
}) {
  const payload = {
    talhao_id: talhaoId,
    geometria,
    ano_safra: anoSafra.trim(),
    profundidade,
    data_coleta: dataColeta || null,
    laboratorio: laboratorio?.trim() || null,
    numero_amostra_lab: numeroAmostraLab?.trim() || null,
    observacoes: observacoes?.trim() || null,
    origem: 'manual',
  }

  for (const chave of CHAVES_PARAMETROS) {
    payload[chave] = paraNumeroOuNulo(valores[chave])
  }

  return payload
}
