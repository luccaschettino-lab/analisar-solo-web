// Ícones de traço (24x24) usados nas telas de login/cadastro. Inline, sem
// biblioteca: são poucos e herdam a cor do texto por `currentColor`.
function Icone({ children, className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export const IconeEmail = (p) => (
  <Icone {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Icone>
)

export const IconeCadeado = (p) => (
  <Icone {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Icone>
)

export const IconeUsuario = (p) => (
  <Icone {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Icone>
)

export const IconeOlho = (p) => (
  <Icone {...p}>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icone>
)

export const IconeOlhoRiscado = (p) => (
  <Icone {...p}>
    <path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.1 3.9M6.1 7.5A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.5 0 2.8-.3 4-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </Icone>
)

export const IconeMapa = (p) => (
  <Icone {...p}>
    <path d="m3 6.5 6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5V6.5Z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Icone>
)

export const IconeFrasco = (p) => (
  <Icone {...p}>
    <path d="M9.5 3.5h5M10.5 3.5v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19l-5.5-9.5v-6" />
    <path d="M7.5 15h9" />
  </Icone>
)

export const IconeAjustes = (p) => (
  <Icone {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icone>
)

export const IconeSeta = (p) => (
  <Icone {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icone>
)
