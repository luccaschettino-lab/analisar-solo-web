# Importação de laudo PDF

Status: **implementado para laudos da UFV (Departamento de Solos)**, lido no
navegador. Outros laboratórios ainda não: o PDF é recusado com uma mensagem
pedindo a Entrada manual.

## Como funciona

1. `ImportarPdf.jsx` recebe o PDF (arrastar ou escolher) — o arquivo **não sai do
   computador**.
2. `lib/extrairLinhasPdf.js` lê o texto com o PDF.js (carregado só nesse
   momento) e o separa em linhas, pela posição de cada pedaço.
3. `lib/laudoUfv.js` lê as três tabelas do laudo e as junta pelo Nº do
   laboratório. Valor ausente (`-`) é `null`; o que o laudo mede e o app não tem
   coluna própria (pH KCl, Na, N, metais pesados...) vai para `extras`.
4. `lib/importacaoLaudo.js` liga cada amostra a uma gleba da fazenda: o número
   de "Gleba 55" casa com a gleba cujo código termina em 55 (`talhão-55`). Se há
   mais de uma, vale a que tem mais pontos de coleta; empate fica para a pessoa
   escolher. A posição da análise no mapa é a média dos pontos de coleta da
   gleba.
5. A tela de conferência mostra tudo, com avisos. Só o que está **pronto e
   marcado** é gravado, pela mesma montagem de payload da entrada manual
   (`lib/payloadAnalise.js`), com `origem = 'pdf'`.

## Regras que não mudam

1. **Parâmetro não encontrado no laudo é `null`, nunca `0`.** Zero é um
   resultado medido. Confundir os dois falsifica todo gráfico e toda média.
2. **As chaves são as de `src/config/parametros.js`** (`CHAVES_PARAMETROS`).
3. **Valores numéricos são `number`**, com a vírgula decimal já resolvida.
4. **A gleba é sugerida, nunca imposta.** Sem gleba confirmada a amostra não é
   gravada. O Nº do laboratório não identifica a gleba (o laboratório renumera a
   cada coleta); a ligação é pela referência do cliente.
5. **Nada é inventado.** Linha com número de colunas inesperado vira aviso e o
   valor fica em branco; nunca se adivinha. Há ainda uma conferência de
   coerência (SB ≈ Ca + Mg + K/390; t = SB + Al; T = SB + H+Al) que acusa coluna
   deslocada.
6. **Não duplica:** uma análise com o mesmo talhão, ano-safra, profundidade e Nº
   do laboratório aparece como "Já importada" e não é gravada de novo.

## Para acrescentar outro laboratório

Escrever um leitor irmão de `laudoUfv.js` (mesma saída: amostras com
`referencia`, `gleba`, `profundidade`, `parametros` e `extras`) e reconhecê-lo em
`ImportarPdf.jsx`. O resto (ligação com glebas, conferência, gravação) é comum.

## Testes

`testes/laudoUfv.mjs` usa um laudo sintético (números inventados — laudos reais
não entram no repositório, que é público).
