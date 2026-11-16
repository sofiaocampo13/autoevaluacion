// Iconos propios (SVG con trazo de 1,75 px, esquinas redondeadas, 24×24): una sola familia para toda la interfaz.
const PATHS = {
  inicio: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  labs: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />,
  materiales: <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 21V5" />,
  analisis: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  infografia: <path d="M12 3v9l7 4M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" />,
  informes: <path d="M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6" />,
  historial: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3" />,
  perfil: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  acerca: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  salir: <path d="M9 4.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3M15.5 8l4 4-4 4M19.5 12H9.5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  mas: <path d="M12 5v14M5 12h14" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
