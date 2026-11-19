import { montarExportacao } from './montagem.js'
import { gerarPlanilha } from './planilha.js'
import { camadasGeo, gerarKml, gerarShapefiles, kmlDasImagens } from './mapas.js'
import { carregarDadosParaExportar, baixarFoto } from '../../dados/exportacao.js'
import { calcularComCache } from '../../paginas/monitoramento/useIndices.js'
import { listarCenasSentinel, bboxDaGeometria } from '../../dados/sentinel.js'
import { imagemDoIndice } from '../rasterIndice.js'
import { ehPonto } from '../geo.js'
import logoUrl from '../../assets/marca/moinho-completo.jpg'

/**
 * Monta os arquivos escolhidos na tela de Exportar e devolve um único Blob
 * para baixar: a planilha sozinha (.xlsx) quando é só ela, senão um ZIP com
 * tudo em pastas. As bibliotecas pesadas (ExcelJS, JSZip, shp-write) só
 * carregam aqui, quando alguém clica em Exportar.
 */

const LIMPO_MINIMO = 80 // % do talhão sem nuvem para a imagem valer

const nomeArquivo = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'sem_nome'

/** Roda `tarefa` em cada item, `simultaneas` de cada vez (ordem do resultado = ordem dos itens). */
async function emParalelo(itens, simultaneas, tarefa) {
  const resultados = new Array(itens.length)
  let proximo = 0
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo++
      resultados[i] = await tarefa(itens[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(simultaneas, itens.length) }, trabalhador))
  return resultados
}

// Quantos ao mesmo tempo: fotos são arquivos pequenos no Storage; o satélite é
// conta pesada na função do servidor, então menos de cada vez.
const FOTOS_SIMULTANEAS = 12
const SATELITE_SIMULTANEOS = 4

const hoje = () => new Date().toISOString().slice(0, 10)

function dataUrlParaBytes(url) {
  const binario = atob(url.split(',')[1])
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

/** Cena do Sentinel para o talhão: a mais recente limpa (ou a mais próxima da data pedida). */
async function escolherCena(talhao, indicesGuardados, dataAlvo) {
  const alvo = dataAlvo ? Date.parse(dataAlvo) : Date.now()
  const proximidade = (d) => Math.abs(Date.parse(d) - alvo)
  const guardadas = indicesGuardados
    .filter((i) => i.talhao_id === talhao.id && i.fonte === 'sentinel')
    .filter((i) => {
      const q = i.qualidade ?? {}
      return q.pixelsNoTalhao && (q.validos / q.pixelsNoTalhao) * 100 >= LIMPO_MINIMO
    })
    .filter((i) => !dataAlvo || Date.parse(i.data) <= alvo + 86400000 * 15)
    .sort((a, b) => proximidade(a.data) - proximidade(b.data))
  if (guardadas[0]) return { id: guardadas[0].cena_id, data: guardadas[0].data }

  // Nada guardado no banco: pergunta ao catálogo e fica com a de menos nuvem perto da data.
  const bbox = bboxDaGeometria(talhao.geometria)
  const cenas = await listarCenasSentinel(bbox, talhao.geometria)
  const boas = cenas.filter((c) => (c.nuvens ?? 100) <= 20).sort((a, b) => proximidade(a.data) - proximidade(b.data))
  const cena = boas[0] ?? [...cenas].sort((a, b) => proximidade(a.data) - proximidade(b.data))[0]
  return cena ? { id: cena.id, data: cena.data } : null
}

/**
 * opcoes: {
 *   fazenda, talhoes, glebas, criterio, parametrosDoCriterio,
 *   filtro: { talhoes, safras, profundidades },
 *   partes: Set (glebas, interpretacao, talhoes, analises, pontos, satelite, comparacao, criterios),
 *   comparar: { safraA, safraB } | null,
 *   mapas: { formatos: Set(kml, shp, geojson), camadas: [talhoes, glebas, pontos] } | null,
 *   fotos: boolean,
 *   imagens: { indices: [ndvi...], data: 'aaaa-mm-dd' | null, prontas, real, kmz } | null,
 * }
 * aoProgredir(texto, fracao)
 */
export async function gerarExportacao(opcoes, aoProgredir = () => {}) {
  const { fazenda } = opcoes
  aoProgredir('Buscando os dados da fazenda…', 0.03)
  const brutos = await carregarDadosParaExportar(fazenda.id)
  const dados = montarExportacao({
    fazenda,
    talhoes: opcoes.talhoes,
    glebas: opcoes.glebas,
    ...brutos,
    parametrosDoCriterio: opcoes.parametrosDoCriterio,
    filtro: opcoes.filtro,
    comparar: opcoes.comparar,
  })

  const arquivos = [] // { caminho, conteudo }
  const base = `Moinho_${nomeArquivo(fazenda.nome)}_${hoje()}`
  const faltas = []

  // ---- Planilha ----
  if (opcoes.partes.size) {
    aoProgredir('Montando a planilha…', 0.12)
    const { default: ExcelJS } = await import('exceljs')
    let logo = null
    try {
      logo = await (await fetch(logoUrl)).arrayBuffer()
    } catch {
      // Sem a logo a planilha sai igual, só sem a imagem na capa.
    }
    const wb = await gerarPlanilha(dados, {
      ExcelJS,
      logo,
      partes: opcoes.partes,
      parametrosDoCriterio: opcoes.parametrosDoCriterio,
      criterio: opcoes.criterio,
      comparar: opcoes.comparar,
    })
    arquivos.push({ caminho: `${base}.xlsx`, conteudo: new Uint8Array(await wb.xlsx.writeBuffer()) })
  }

  // ---- Mapas ----
  if (opcoes.mapas?.formatos.size) {
    aoProgredir('Gerando os mapas…', 0.25)
    const camadas = camadasGeo(dados)
    const incluidas = opcoes.mapas.camadas
    if (opcoes.mapas.formatos.has('kml')) {
      arquivos.push({ caminho: `Mapas/${nomeArquivo(fazenda.nome)}.kml`, conteudo: gerarKml(camadas, { nomeFazenda: fazenda.nome, camadasIncluidas: incluidas }) })
    }
    if (opcoes.mapas.formatos.has('geojson')) {
      for (const c of incluidas) {
        if (camadas[c].features.length) arquivos.push({ caminho: `Mapas/GeoJSON/${c === 'pontos' ? 'pontos_amostra' : c}.geojson`, conteudo: JSON.stringify(camadas[c]) })
      }
    }
    if (opcoes.mapas.formatos.has('shp')) {
      const shpwrite = (await import('@mapbox/shp-write')).default
      const JSZip = (await import('jszip')).default
      const zips = await gerarShapefiles(camadas, shpwrite, incluidas)
      for (const [chave, bytes] of Object.entries(zips)) {
        const dentro = await JSZip.loadAsync(bytes)
        for (const [nome, entrada] of Object.entries(dentro.files)) {
          if (entrada.dir) continue
          const pasta = chave === 'pontos' ? 'pontos_amostra' : chave
          arquivos.push({ caminho: `Mapas/Shapefile/${pasta}/${nome.split('/').pop()}`, conteudo: await entrada.async('uint8array') })
        }
      }
    }
  }

  // ---- Imagens de satélite ----
  // prontas: JPG de relatório (fundo + índice + legenda + logo), uma por
  // talhão e índice; real: o mesmo quadro só com a foto de satélite; kmz:
  // as camadas cruas para o Google Earth (KMZ + PNG).
  const img = opcoes.imagens
  const querIndices = img && img.indices.length > 0 && (img.prontas || img.kmz)
  if (img && (querIndices || img.real)) {
    const talhoesArea = dados.talhoes.filter((t) => t.geometria && !ehPonto(t.geometria))
    const desenho = img.prontas || img.real ? await import('./imagemDoTalhao.js') : null
    let feitos = 0
    const porTalhao = await emParalelo(talhoesArea, SATELITE_SIMULTANEOS, async (t) => {
      const camadas = []
      const pastaPronta = `Satelite/Imagens prontas/Talhao_${nomeArquivo(t.codigo)}`
      let fundo = null
      try {
        if (desenho) fundo = await desenho.prepararFundo(t.geometria)
        if (img.real && fundo) {
          const blob = await desenho.desenharImagemDoTalhao({ fazenda, talhao: t, fundo, dados: null, indice: null, data: null })
          arquivos.push({ caminho: `${pastaPronta}/${desenho.nomeDaImagem(t, null, null)}`, conteudo: new Uint8Array(await blob.arrayBuffer()), jaComprimido: true })
        }
        if (querIndices) {
          const cena = await escolherCena(t, brutos.indices, img.data)
          if (!cena) {
            faltas.push(`Talhão ${t.codigo}: sem imagem de satélite no período.`)
          } else {
            const resposta = await calcularComCache(t.id, cena.id, t.geometria)
            const data = new Date(cena.data).toLocaleDateString('pt-BR')
            const dataArq = cena.data.slice(0, 10)
            for (const indice of img.indices) {
              if (img.kmz) {
                const arquivo = `imagens/${indice}/talhao_${nomeArquivo(t.codigo)}_${dataArq}.png`
                camadas.push({ talhao: t.codigo, indice, data, arquivo, bbox: resposta.janela.bbox, bytes: dataUrlParaBytes(imagemDoIndice(resposta, indice)) })
              }
              if (img.prontas && fundo) {
                const blob = await desenho.desenharImagemDoTalhao({ fazenda, talhao: t, fundo, dados: resposta, indice, data: cena.data })
                arquivos.push({ caminho: `${pastaPronta}/${desenho.nomeDaImagem(t, indice, cena.data)}`, conteudo: new Uint8Array(await blob.arrayBuffer()), jaComprimido: true })
              }
            }
          }
        }
      } catch (e) {
        faltas.push(`Talhão ${t.codigo}: ${e.message || 'falha ao montar a imagem'}.`)
      }
      feitos++
      aoProgredir(`Imagens de satélite: ${feitos} de ${talhoesArea.length} talhões…`, 0.3 + 0.4 * (feitos / talhoesArea.length))
      return camadas
    })
    const imagens = porTalhao.flat()
    if (imagens.length) {
      const JSZip = (await import('jszip')).default
      const kmz = new JSZip()
      kmz.file('doc.kml', kmlDasImagens(imagens, { nomeFazenda: fazenda.nome }))
      for (const im of imagens) {
        kmz.file(im.arquivo, im.bytes, { compression: 'STORE' }) // PNG já é comprimido
        arquivos.push({ caminho: `Satelite/Google Earth/${im.arquivo.replace(/^imagens\//, '')}`, conteudo: im.bytes })
      }
      arquivos.push({
        caminho: `Satelite/Google Earth/indices_${nomeArquivo(fazenda.nome)}.kmz`,
        conteudo: await kmz.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }),
      })
    }
  }

  // ---- Fotos do perfil do solo ----
  if (opcoes.fotos && dados.fotos.length) {
    let feitas = 0
    aoProgredir(`Baixando as fotos do solo (0 de ${dados.fotos.length})…`, 0.7)
    const baixadas = await emParalelo(dados.fotos, FOTOS_SIMULTANEAS, async (f) => {
      let arquivo = null
      try {
        const blob = await baixarFoto(f.caminho)
        const ext = (f.caminho.split('.').pop() || 'jpg').toLowerCase()
        arquivo = {
          caminho: `Fotos do solo/Talhao_${nomeArquivo(f.talhao)}/Gleba_${nomeArquivo(f.gleba)}/${nomeArquivo(f.gleba)}_safra_${nomeArquivo(f.ano_safra)}_${nomeArquivo(f.profundidade)}cm.${ext}`,
          conteudo: new Uint8Array(await blob.arrayBuffer()),
          jaComprimido: true,
        }
      } catch {
        faltas.push(`Foto da gleba ${f.gleba} (${f.ano_safra}, ${f.profundidade} cm) não pôde ser baixada.`)
      }
      feitas++
      aoProgredir(`Baixando as fotos do solo (${feitas} de ${dados.fotos.length})…`, 0.7 + 0.22 * (feitas / dados.fotos.length))
      return arquivo
    })
    arquivos.push(...baixadas.filter(Boolean))
  }

  if (arquivos.length === 0) throw new Error('Nada para exportar com essas escolhas.')

  aoProgredir('Fechando o arquivo…', 0.95)
  if (arquivos.length === 1 && arquivos[0].caminho.endsWith('.xlsx') && faltas.length === 0) {
    return {
      blob: new Blob([arquivos[0].conteudo], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      nome: arquivos[0].caminho,
      faltas,
      totais: dados.totais,
    }
  }
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const pasta = zip.folder(base)
  for (const a of arquivos) {
    const imagem = a.jaComprimido || /\.(png|jpe?g|kmz|zip)$/i.test(a.caminho)
    pasta.file(a.caminho, a.conteudo, imagem ? { compression: 'STORE' } : undefined)
  }
  pasta.file('LEIA-ME.txt', leiaMe(fazenda, arquivos, faltas))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  aoProgredir('Pronto!', 1)
  return { blob, nome: `${base}.zip`, faltas, totais: dados.totais }
}

function leiaMe(fazenda, arquivos, faltas) {
  const tem = (p) => arquivos.some((a) => a.caminho.startsWith(p) || a.caminho.endsWith(p))
  const linhas = [
    `MOINHO — exportação da fazenda ${fazenda.nome}`,
    `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    fazenda.exemplo ? '\nATENÇÃO: fazenda de exemplo, dados fictícios.' : '',
    '',
    'O que tem aqui:',
  ]
  if (tem('.xlsx')) linhas.push('- Planilha (.xlsx): abra no Excel ou no Google Planilhas. A aba "Resumo" explica as outras.')
  if (tem('Mapas/') && tem('.kml')) linhas.push('- Mapas/*.kml: talhões, glebas e pontos de amostra. Abre no Google Earth (arraste o arquivo para dentro dele).')
  if (tem('Mapas/Shapefile')) linhas.push('- Mapas/Shapefile: uma pasta por camada (.shp, .shx, .dbf, .prj). Abre no QGIS, ArcGIS e softwares de agricultura de precisão. As glebas trazem a análise mais recente (0-20) como atributos.')
  if (tem('Mapas/GeoJSON')) linhas.push('- Mapas/GeoJSON: as mesmas camadas em GeoJSON (sistemas web, QGIS).')
  if (tem('Satelite/Imagens prontas')) linhas.push('- Satelite/Imagens prontas: uma imagem JPG por talhão e índice, com a foto de satélite de fundo, a legenda (quanto do talhão em cada faixa), a data e a logo. Pronta para mandar ou pôr em relatório. Cinza = nuvem.')
  if (tem('Satelite/Google Earth')) linhas.push('- Satelite/Google Earth: o .kmz abre no Google Earth com cada índice numa pasta (ligue/desligue na lista à esquerda); os PNG soltos são as mesmas camadas.')
  if (tem('Fotos do solo/')) linhas.push('- Fotos do solo: uma pasta por talhão e gleba, com a safra e a profundidade no nome do arquivo.')
  if (faltas.length) linhas.push('', 'Ficou de fora:', ...faltas.map((f) => `- ${f}`))
  return linhas.filter((l) => l !== null).join('\r\n')
}
