# Importação de laudo PDF — contrato

Status: **não implementado**. `ImportarPdf.jsx` é um placeholder visual, sem
lógica. A extração está a cargo de outro time.

Este documento descreve o que o app espera receber, para que a integração seja
uma troca de dados e não uma negociação.

## O serviço

Recebe **um PDF** (o laudo do laboratório, que costuma trazer várias amostras) e
devolve **um array de análises extraídas**, uma por amostra encontrada.

O serviço **não grava nada**. Ele extrai e sugere; quem decide e grava é o
usuário, na tela de conferência. Isso não é detalhe de implementação: um laudo
mal lido que entra sozinho no banco corrompe a série histórica da gleba, e o
erro só aparece anos depois, num gráfico que ninguém sabe explicar.

## Formato de saída

```jsonc
{
  "laboratorio": "Lab Solo Viçosa",   // string | null — nome do laboratório
  "data_coleta": "2026-05-10",        // string | null — ISO 8601, só data
  "confianca_geral": 0.92,            // number 0..1 — qualidade da extração
  "analises": [ /* ver abaixo */ ]
}
```

Cada item de `analises`:

```jsonc
{
  // --- identificação no laudo ---
  "numero_amostra_lab": "2871",       // string | null — como impresso
  "identificacao_bruta": "Lote 8 / Amostra 12",  // string | null — texto original

  // --- chave natural, quando o laudo informa ---
  "ano_safra": "25-26",               // string | null — formato "AA-AA"
  "profundidade": "0-20",             // "0-20" | "20-40" | "40-60" | "outro" | null

  // --- vínculo sugerido, nunca decidido ---
  "gleba_sugerida": {
    "gleba_id": "uuid | null",
    "motivo": "numero_amostra_lab",   // como chegou nessa sugestão
    "confianca": 0.81                 // number 0..1
  },

  // --- os 24 parâmetros ---
  "parametros": {
    "ph_h2o": 5.9,
    "p": 18.7,
    "k": 104,
    "s": null                         // ausente = null, NUNCA 0
    // ... demais chaves conforme src/config/parametros.js
  },

  // --- rastreabilidade ---
  "avisos": [
    { "campo": "p", "mensagem": "valor ilegível, leitura incerta" }
  ]
}
```

## Regras inegociáveis

1. **Parâmetro não encontrado no laudo é `null`, nunca `0`.** Zero é um
   resultado medido. Confundir os dois falsifica todo gráfico e toda média daí
   para frente. É a regra central do produto inteiro.

2. **As chaves de `parametros` são exatamente as de `src/config/parametros.js`**
   (`CHAVES_PARAMETROS`). Nada de sinônimo, abreviação ou nome do laboratório.
   A conversão de nomenclatura é responsabilidade do extrator.

3. **Valores numéricos são `number`, já convertidos.** Nada de `"5,4"` como
   string — a vírgula decimal do laudo brasileiro se resolve na extração.

4. **`gleba_sugerida` é sugestão, não decisão.** O `numero_amostra_lab` **não
   identifica a gleba**: o laboratório renumera a cada coleta. A sugestão só
   pode vir de correspondência com uma análise anterior que já tenha aquele
   número, e ainda assim precisa ser confirmada pelo usuário. Ver o modelo
   conceitual no `PROJECT_CONTEXT.md`.

5. **Unidades são as da tabela de parâmetros.** Se o laudo usar outra, a
   conversão é da extração. O app não converte nada.

6. **Nunca inventar valor por interpolação ou média.** Ilegível é `null` com um
   aviso, não uma estimativa.

## O que o app faz com isso

1. Mostra a lista extraída numa tela de conferência, com os avisos visíveis.
2. Deixa o usuário corrigir qualquer campo e escolher a gleba de cada amostra.
3. Só então grava, pela mesma camada de `src/dados/analises.js` usada pela
   entrada manual — inclusive a checagem de conflito na chave natural
   `(gleba_id, ano_safra, profundidade)`.

## O que ainda não está decidido

- Como o serviço é chamado: Edge Function do Supabase, endpoint externo, ou
  processamento no cliente.
- Autenticação da chamada.
- Limite de tamanho e de páginas do PDF.
- Se a conferência é uma tela nova ou uma terceira aba de `/#/dados`.

Nada disso bloqueia a extração: o contrato de dados acima é suficiente para os
dois lados trabalharem em paralelo.
