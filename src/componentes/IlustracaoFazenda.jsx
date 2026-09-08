/**
 * Vista aérea abstrata de talhões, para o painel de marca do login.
 *
 * Não é uma foto de banco de imagens — é a mesma linguagem visual do mapa
 * que o produto desenha depois que a pessoa entra: polígonos coloridos,
 * contorno claro, pontos de amostra. Quem loga já vê, sem saber ainda, uma
 * versão estilizada da própria tela que vai usar.
 *
 * Sempre escura, nos dois temas — é painel de marca, não conteúdo de
 * leitura, e não deveria mudar com a preferência de tema da pessoa.
 */
export default function IlustracaoFazenda({ className = '' }) {
  return (
    <svg
      viewBox="0 0 600 900"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#101f36" />
          <stop offset="55%" stopColor="#0a1526" />
          <stop offset="100%" stopColor="#050b16" />
        </linearGradient>
        <linearGradient id="scrim" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="#050b16" stopOpacity="0" />
          <stop offset="60%" stopColor="#050b16" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#050b16" stopOpacity="0.92" />
        </linearGradient>
      </defs>

      <rect width="600" height="900" fill="url(#ceu)" />

      {/* Talhões: formas grandes e confiantes, não uma grade perfeita —
          fazenda de verdade não tem parcela retangular. */}
      <g opacity="0.85">
        <path d="M-40,120 C120,60 260,140 380,80 C480,35 560,70 640,40 L640,-40 L-40,-40 Z" fill="#182c48" />

        <path
          d="M-40,90 C90,140 180,60 320,110 C410,142 480,95 640,130
             L640,340 C520,300 470,360 380,320 C280,278 200,350 90,300
             C30,275 -20,300 -40,280 Z"
          fill="#2e7d32"
          fillOpacity="0.9"
        />

        <path
          d="M-40,280 C40,300 90,255 180,290 C260,320 300,270 400,300
             C500,330 560,290 640,320
             L640,520 C540,480 500,540 410,505 C320,470 260,530 160,495
             C80,466 30,500 -40,470 Z"
          fill="#f2b134"
          fillOpacity="0.65"
        />

        <path
          d="M-40,470 C60,500 120,455 230,480 C330,502 380,450 480,470
             C540,483 590,465 640,478
             L640,660 C560,630 500,680 420,650 C330,617 260,670 160,640
             C90,618 20,645 -40,630 Z"
          fill="#00695c"
          fillOpacity="0.55"
        />

        <path
          d="M-40,630 C70,660 150,615 260,645 C360,672 420,625 520,650
             C560,660 600,650 640,660
             L640,900 L-40,900 Z"
          fill="#3d8b40"
          fillOpacity="0.9"
        />

        <path
          d="M120,720 C210,700 260,745 350,725 C420,710 470,740 540,725
             L560,900 L100,900 Z"
          fill="#6b4226"
          fillOpacity="0.45"
        />
      </g>

      {/* Divisas: o mesmo contorno claro que separa gleba de talhão no mapa. */}
      <g stroke="#e7f4ea" strokeOpacity="0.22" strokeWidth="2" fill="none">
        <path d="M-40,280 C40,300 90,255 180,290 C260,320 300,270 400,300 C500,330 560,290 640,320" />
        <path d="M-40,470 C60,500 120,455 230,480 C330,502 380,450 480,470 C540,483 590,465 640,478" />
        <path d="M-40,630 C70,660 150,615 260,645 C360,672 420,625 520,650 C560,660 600,650 640,660" />
      </g>

      {/* Pontos de amostra, como os marcadores de gleba no mapa. */}
      <g>
        <circle cx="200" cy="380" r="5" fill="#ffffff" fillOpacity="0.85" />
        <circle cx="430" cy="240" r="5" fill="#ffffff" fillOpacity="0.7" />
        <circle cx="330" cy="560" r="5" fill="#ffffff" fillOpacity="0.75" />
        <circle cx="150" cy="540" r="5" fill="#f2b134" className="motion-safe:animate-pulso" />
        <circle
          cx="150"
          cy="540"
          r="5"
          fill="none"
          stroke="#f2b134"
          strokeWidth="1.5"
          className="motion-safe:animate-pulso-anel"
          style={{ transformOrigin: '150px 540px' }}
        />
      </g>

      <rect width="600" height="900" fill="url(#scrim)" />
    </svg>
  )
}
