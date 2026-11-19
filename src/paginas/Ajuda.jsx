import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTutorial } from '../context/TutorialContext.jsx'

/**
 * Ajuda: o que é e como se usa cada parte do sistema, em perguntas curtas.
 * Texto puro em dados (não JSX) para a busca poder filtrar por qualquer
 * palavra da pergunta ou da resposta.
 *
 * Ao mudar um comportamento do sistema, mude a resposta aqui também.
 */
const SECOES = [
  {
    id: 'comeco',
    titulo: 'Para começar',
    itens: [
      [
        'O que o Moinho faz?',
        'Transforma as análises de solo da fazenda em mapas. Você vê, talhão por talhão, onde falta ou sobra cada nutriente, compara safras e acompanha a lavoura pelo satélite.',
      ],
      [
        'Em que ordem eu cadastro as coisas?',
        'Fazenda → talhões → pontos de amostra (que viram as glebas) → análises → mapa. Cada passo usa o anterior: sem talhão não há onde pôr os pontos, e sem gleba o laudo não sabe a que lugar pertence cada amostra. A lista "Primeiros passos", na barra lateral, mostra o que falta.',
      ],
      [
        'Como funciona o tutorial guiado?',
        'São 11 fases, como num jogo: um cartão no canto da tela diz a tarefa, o botão certo pisca, e a fase só avança quando você a conclui. Você monta uma fazenda de exemplo inteira: cria a fazenda, marca a sede, importa os talhões e os pontos (o próprio tutorial entrega os arquivos), digita uma análise, importa um laudo em PDF, conhece os critérios e lê o mapa, a comparação e o satélite. O botão "–" minimiza o cartão.',
      ],
      [
        'O que é a fazenda de exemplo?',
        'É a fazenda que você monta no tutorial guiado, com dados fictícios. Fora do tutorial, ela aparece com uma faixa amarela no topo. Pode mexer à vontade, e o botão "Excluir exemplo" a remove sem tocar nas suas fazendas.',
      ],
      [
        'Dá para deixar a tela clara?',
        'Dá. O site abre no tema escuro, mas o botão de sol/lua no canto superior direito, ao lado de "Sair", troca entre escuro e claro. A escolha fica guardada neste navegador.',
      ],
      [
        'Como faço o tutorial de novo?',
        'Pelo botão "Ver o tutorial de novo", no topo desta página. As boas-vindas abrem e, no fim delas, o tutorial guiado começa outra vez. As dicas de cada tela e os primeiros passos também voltam.',
      ],
    ],
  },
  {
    id: 'fazenda',
    titulo: 'Fazenda',
    itens: [
      ['Como crio uma fazenda?', 'Na barra lateral, "+ Nova fazenda". Só o nome é obrigatório; município e UF ajudam a achar a fazenda depois.'],
      [
        'Para que serve a sede?',
        'É o ponto que marca a fazenda no mapa e o lugar onde o mapa abre enquanto ainda não há talhão. Use "Marcar sede" na barra lateral e clique no mapa. "Ir para a sede" leva o mapa até ela.',
      ],
      [
        'Quem pode mexer na fazenda?',
        'São cinco cargos. Proprietário: tudo, inclusive a equipe e excluir a fazenda. Agrônomo: edita tudo e define os critérios de interpretação e os níveis de controle de pragas. Editor: lança análises e vistorias, desenha e sobe fotos, mas não mexe em critérios. Monitor: quem vai a campo; lança vistorias de pragas e laudos, sem desenhar talhões ou glebas. Leitor: só vê e exporta. Quem cria a fazenda é o proprietário. O seu cargo aparece embaixo do nome da fazenda, na barra lateral.',
      ],
      [
        'Por que o sistema pede a minha senha para excluir?',
        'Excluir não tem volta. Fazenda, talhão, gleba, análise, critério e foto só são apagados depois de você confirmar a senha. A exceção é a fazenda de exemplo, que não tem dado real.',
      ],
    ],
  },
  {
    id: 'talhoes',
    titulo: 'Talhões',
    itens: [
      [
        'Como cadastro os talhões?',
        'De dois jeitos: desenhando no mapa ("+ Talhão", na barra lateral) ou importando um arquivo (Mapa → "Importar talhões"). O arquivo pode ser .kml ou .kmz, .geojson ou shapefile compactado em .zip. Quase sempre os talhões já existem em outro programa e saem prontos de lá: Google Earth, QGIS e os sistemas de agricultura de precisão (como Climate FieldView e John Deere Operations Center) exportam nesses formatos. Antes de gravar, você revisa código, nome e área de cada um.',
      ],
      [
        'Como corrijo o desenho de um talhão?',
        'Selecione o talhão no mapa e use "Editar geometria". Arraste os pontos e grave. Com "Encaixar nas divisas" ligado, o vértice gruda na borda dos talhões vizinhos, para não sobrar fresta.',
      ],
      [
        'Como coloco as fotos do perfil do solo?',
        'Cada gleba tem as suas. Clique na gleba no mapa (ou abra a página dela, aba Foto). Em "Perfil do solo" há um espaço para cada profundidade (0-20, 20-40 e 40-60 cm), empilhados como o perfil. Toque no espaço para enviar a foto (no celular, abre a câmera). As fotos são guardadas por safra: escolha a safra no seletor, ou "Outra safra…" para uma que ainda não está na lista. Clicando na foto ela abre grande, com as opções de trocar e remover.',
      ],
      ['Posso juntar dois talhões?', 'Sim, em "Mesclar talhões", na barra lateral. Glebas, pontos e análises dos talhões juntados passam para o talhão que fica.'],
    ],
  },
  {
    id: 'glebas',
    titulo: 'Glebas e pontos de amostra',
    itens: [
      [
        'O que é uma gleba?',
        'É a área de uma amostra composta: as várias coletas que foram juntas para o laboratório. No arquivo de pontos, as coletas da mesma amostra têm o mesmo número, e esse grupo vira uma gleba. O código segue "talhão-número": amostra 12 no talhão 7 vira a gleba 7-12.',
      ],
      [
        'Como importo os pontos de amostra?',
        'Em Dados → Pontos de amostra, com um shapefile em .zip ou um .geojson de pontos. O número da amostra vem do campo "amostra" ou "id" do arquivo. Ponto fora de qualquer talhão também entra, no talhão mais próximo, e a tela avisa a distância para você conferir.',
      ],
      [
        'Como as glebas são criadas a partir dos pontos?',
        'Depois de importar os pontos, o sistema oferece criar as glebas. Cada parte do talhão fica com a amostra do ponto mais próximo, então as glebas juntas cobrem o talhão inteiro, sem vão.',
      ],
      [
        'Uma gleba pode passar para o talhão vizinho?',
        'Sim. Se parte das coletas de uma amostra caiu do outro lado da divisa (até 500 m dos outros pontos), a gleba continua uma só e ocupa os dois talhões. Ela fica no talhão onde está a maioria dos pontos.',
      ],
      [
        'Posso criar uma gleba à mão?',
        'Pode. Abra o talhão na lista da barra lateral e use "+ Gleba": marque um ponto, desenhe uma sub-área ou cole uma lista de coordenadas. Também dá para importar glebas de um arquivo ("Importar glebas").',
      ],
      [
        'Para que serve "Ajustar glebas já criadas ao talhão"?',
        'Redesenha as glebas que vieram dos pontos para preencherem todo o talhão. Use depois de mudar pontos ou glebas. Talhão que tem gleba desenhada à mão fica como está.',
      ],
    ],
  },
  {
    id: 'analises',
    titulo: 'Análises',
    itens: [
      [
        'Como lanço as análises?',
        'Em Dados, de dois jeitos: importando o laudo em PDF (formato do laboratório de solos da UFV), que já liga cada amostra à sua gleba pelo número, ou digitando em "Entrada manual".',
      ],
      [
        'O laudo mostrou amostras "Sem gleba". O que faço?',
        'A amostra do laudo não achou gleba com aquele número. Importe os pontos de amostra antes, ou escolha a gleba na própria tabela. Amostra sem gleba não é gravada.',
      ],
      ['Como escrevo a safra?', 'No formato "25-26": os dois últimos dígitos dos dois anos, com hífen.'],
      [
        'Por que o sistema diz que a análise já existe?',
        'Cada análise é única pelo talhão, safra, profundidade e número do laboratório. Reimportar o mesmo laudo pula as que já estão gravadas, em vez de dobrar.',
      ],
    ],
  },
  {
    id: 'mapa',
    titulo: 'Mapa e Filtros',
    itens: [
      [
        'Como pinto o mapa pelo solo?',
        'Em Filtros, escolha a safra, a profundidade e o parâmetro (pH, P, K…). O mapa abre neutro de propósito: a cor só aparece quando você escolhe o que quer ver.',
      ],
      [
        'O que as cores querem dizer?',
        'Verde é o ideal. Laranja e vermelho afastam do ideal, tanto para menos quanto para mais: pouco demais e muito demais são ruins. O rótulo da legenda diz de que lado está. No Al e na saturação por alumínio, quanto menos melhor, então o pouco é verde.',
      ],
      [
        'O que é a área listrada?',
        'Onde não há medição para o filtro escolhido: talhão sem análise, ou gleba sem amostra própria. O sistema não inventa valor onde ninguém mediu.',
      ],
      [
        'Como funciona o mapa de calor?',
        'Cada análise fica na posição da sua amostra, e o sistema estima o valor entre elas, cobrindo o talhão inteiro. Quanto mais amostras, mais fiel a mancha.',
      ],
      ['Posso desligar a cor?', 'Sim, em "Cor de preenchimento" no mapa: os talhões ficam só com o contorno, e o satélite aparece inteiro.'],
    ],
  },
  {
    id: 'comparar',
    titulo: 'Comparar anos',
    itens: [
      [
        'Como comparo duas safras?',
        'Em Comparar anos, escolha as duas safras e o parâmetro. O mapa mostra onde subiu, onde caiu e onde ficou igual. Diferença pequena conta como "igual", porque parte da variação é ruído de amostragem e de laboratório.',
      ],
    ],
  },
  {
    id: 'monitoramento',
    titulo: 'Monitoramento por satélite',
    itens: [
      [
        'De onde vêm as imagens?',
        'Do satélite Sentinel-2 (Europa). Ele passa a cada 2 a 5 dias, com quadradinhos de 10 m e reflectância já corrigida da atmosfera; é o que dá imagem toda semana. Na época de chuva, muitas imagens vêm nubladas, e nenhum satélite óptico enxerga através da nuvem.',
      ],
      [
        'Qual índice uso?',
        'NDVI para o vigor da lavoura (o mais comum). EVI quando a lavoura já fechou e o NDVI satura. SAVI no começo da safra ou em falha, com solo exposto. NDWI mostra água na superfície (rio, açude, área alagada). Ele não mede umidade do solo.',
      ],
      [
        'Qual data escolho?',
        'Na barra do tempo, cada bolinha é uma imagem. As verdes têm até 20% de nuvem na região e são as melhores. A nuvem de cada imagem é medida na região inteira; no talhão pode ser mais ou menos. Os pixels com nuvem aparecem em cinza no mapa e ficam fora das contas, e o painel diz quanto do talhão entrou no cálculo.',
      ],
    ],
  },
  {
    id: 'pragas',
    titulo: 'Pragas e doenças',
    itens: [
      [
        'Como lanço uma vistoria?',
        'Em Pragas, aba "Por talhão", escolha o talhão e clique em "Nova vistoria" (data, cultura e estádio). Depois, em cada ponto do talhão: toque em "Usar meu GPS" (ou toque no mapa), acrescente o que achou e preencha o valor, tire uma foto se quiser e grave. O painel fica aberto para o próximo ponto, com as mesmas pragas e os valores em branco.',
      ],
      [
        'Quais jeitos de medir existem?',
        'Pano de batida (insetos por metro), contagem na amostra (atacados de quantos olhados, vira %), % estimada (desfolha, folhas com sintoma), presença (achou ou não) e nota visual (baixo, médio, alto). Cada praga já vem com o jeito mais comum, mas dá para trocar na hora.',
      ],
      [
        'O que significam as cores?',
        'Vermelho (Agir): o talhão passou do nível de controle. Amarelo (Atenção): chegou a 70% do nível. Verde (Tranquilo): abaixo. Cinza: a praga não tem nível definido, só registra. O valor do talhão é a média de todos os pontos da vistoria; ponto onde a praga não apareceu conta como zero. Na nota visual, a cor é a própria nota.',
      ],
      [
        'De onde vêm os níveis de controle?',
        'Da Embrapa Soja (MIP-Soja 2023), Embrapa Café, Embrapa Rondônia e Epamig. Ex.: percevejos 2 por metro na soja de grão a partir de R3; desfolha 30% no vegetativo e 15% no reprodutivo; bicho-mineiro 30% das folhas minadas; broca-do-café 3% dos frutos; ferrugem do café 5% das folhas. O proprietário e o agrônomo ajustam na aba "Pragas e níveis" e podem acrescentar pragas.',
      ],
      [
        'O mapa de calor é exato?',
        'Não: ele estima a infestação entre os pontos a partir dos mais próximos. Quanto mais pontos bem espalhados, melhor. Serve para ver onde a praga se concentra e onde olhar de novo.',
      ],
    ],
  },
  {
    id: 'exportar',
    titulo: 'Exportar',
    itens: [
      [
        'O que dá para exportar?',
        'Tudo da fazenda: uma planilha Excel (glebas com todos os parâmetros, interpretação, talhões, análises, pontos de amostra, resumo do satélite, comparação de safras e critérios), os mapas de talhões, glebas e pontos (KML para o Google Earth, Shapefile para QGIS e softwares de agricultura de precisão, GeoJSON), as imagens de NDVI, EVI, SAVI e NDWI de cada talhão e as fotos do perfil do solo. Em Exportar, marque o que quer e clique em "Exportar e baixar".',
      ],
      [
        'Como a planilha vem organizada?',
        'A aba Resumo traz a logo, os dados da fazenda, o critério usado e a legenda das cores. Na aba Glebas, cada linha é uma gleba numa safra e numa profundidade; cada valor vem pintado com a cor do nível (vermelho, laranja, verde), igual ao mapa. Todas as colunas têm filtro, e o cabeçalho fica parado ao rolar.',
      ],
      [
        'Posso exportar só uma parte?',
        'Pode. No Recorte, escolha os talhões, as safras e as profundidades; vale para tudo o que sair. Quem tem acesso à fazenda, mesmo só para ver, pode exportar.',
      ],
      [
        'Como saem as imagens de satélite?',
        'Em "Imagens prontas", cada talhão vira uma imagem JPG igual à do Monitoramento: a foto de satélite de fundo, o índice por cima, a legenda com quanto do talhão está em cada faixa, a data, a escala e a logo do Moinho. Dá para pedir também a "imagem real" (o talhão na foto de satélite, sem índice) e o arquivo para o Google Earth (.kmz). O sistema usa a imagem mais recente sem nuvem de cada talhão, ou a mais perto da data que você escolher.',
      ],
      [
        'Dá para baixar só a imagem que estou vendo?',
        'Dá. No Monitoramento, o botão "Baixar imagem", no canto de cima do mapa, baixa o talhão, o índice e a data que estão na tela, já no formato de relatório. Com "Sem filtro" escolhido, sai a imagem real do talhão.',
      ],
    ],
  },
  {
    id: 'criterios',
    titulo: 'Critérios',
    itens: [
      [
        'O que são os critérios?',
        'São as faixas que dizem o que é baixo, ideal e alto em cada parâmetro, e que decidem a cor do mapa. O sistema não decide isso sozinho: depende da cultura, do solo e do laboratório. Por isso, uma fazenda nova fica sem cores no mapa até o agrônomo criar um conjunto em Critérios e clicar em "Aplicar nesta fazenda". Um conjunto novo já nasce com a tabela de referência do sistema; ele ajusta só o que precisar. (Na fazenda de exemplo do tutorial, o conjunto vem pronto.)',
      ],
    ],
  },
  {
    id: 'problemas',
    titulo: 'Problemas comuns',
    itens: [
      [
        'Apareceu "Não foi possível conectar".',
        'Confira a sua internet. Se ela estiver funcionando, o site pode estar em manutenção: tente mais tarde ou fale com o suporte.',
      ],
      [
        'O mapa ficou cinza, sem cor.',
        'Falta escolher safra, profundidade ou parâmetro em Filtros, a fazenda ainda não tem análise para essa escolha, ou ainda não tem critério aplicado (veja Critérios).',
      ],
      [
        'Um ponto de amostra ficou cinza no mapa.',
        'A gleba dele não tem análise na safra e profundidade escolhidas, ou o ponto ainda não está ligado a uma gleba.',
      ],
    ],
  },
]

const semAcento = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export default function Ajuda() {
  const { recomecar } = useTutorial()
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    const termo = semAcento(busca.trim())
    if (!termo) return SECOES
    return SECOES.map((s) => ({
      ...s,
      itens: s.itens.filter(([p, r]) => semAcento(`${s.titulo} ${p} ${r}`).includes(termo)),
    })).filter((s) => s.itens.length > 0)
  }, [busca])

  const buscando = busca.trim().length > 0

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Ajuda</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">O que é e como se usa cada parte do sistema.</p>
          </div>
          <button
            type="button"
            onClick={recomecar}
            className="rounded-md border border-solo-600 px-3 py-2 text-sm font-medium text-solo-700 hover:bg-solo-50 dark:border-solo-500 dark:text-solo-300 dark:hover:bg-solo-500/10"
          >
            Ver o tutorial de novo
          </button>
        </header>

        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar: laudo, gleba, cor, satélite…"
          aria-label="Buscar na ajuda"
          className="mt-5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-solo-600 focus:ring-2 focus:ring-solo-100 dark:border-white/15 dark:bg-noite-800 dark:text-slate-100 dark:focus:border-solo-500 dark:focus:ring-solo-500/30"
        />

        <div className="mt-6 gap-8 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)]">
          {/* Índice, só em tela larga e sem busca. */}
          <nav aria-label="Assuntos" className="hidden lg:block">
            <ul className="sticky top-0 space-y-1 text-sm">
              {SECOES.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#ajuda-${s.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      setBusca('')
                      document.getElementById(`ajuda-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className="block rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
                  >
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-8">
            {filtradas.length === 0 && (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                Nada encontrado para "{busca}". Tente outra palavra.
              </p>
            )}
            {filtradas.map((s) => (
              <section key={s.id} id={`ajuda-${s.id}`} className="scroll-mt-4">
                <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">{s.titulo}</h2>
                <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
                  {s.itens.map(([pergunta, resposta]) => (
                    // Com busca, abertas: quem buscou quer ler a resposta.
                    <details key={pergunta} open={buscando} className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/5">
                        {pergunta}
                        <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-90">
                          ›
                        </span>
                      </summary>
                      <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{resposta}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400 dark:text-slate-500">
          Não achou? Fale com o suporte. <Link to="/" className="underline">Voltar ao mapa</Link>
        </p>
      </div>
    </div>
  )
}
