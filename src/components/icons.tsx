// Iconos propios (SVG con trazo de 1,75 px, esquinas redondeadas, 24×24): una sola familia para toda la interfaz.
const PATHS = {
  panel: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5zM13 5.5A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v2a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 7.5zM13 13.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5zM4 15.5A1.5 1.5 0 0 1 5.5 14h4a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5z" />,
  labs: <path d="M9.5 3.5h5M10.5 3.5v5.8L5.2 18a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3l-5.3-8.7V3.5M7.6 14.5h8.8" />,
  analisis: <path d="M5 20v-7M12 20V5M19 20v-10" />,
  mapa: (
    <>
      <circle cx="12" cy="5.5" r="2" />
      <circle cx="5.5" cy="18" r="2" />
      <circle cx="18.5" cy="18" r="2" />
      <path d="M12 7.5v4M12 11.5l-5.2 4.8M12 11.5l5.2 4.8" />
    </>
  ),
  materiales: <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.6l2 2h7.4a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
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
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** Marca de la plataforma: una línea que asciende hacia un punto (avance), dentro de un cuadrado redondeado. */
export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <rect width="36" height="36" rx="10" fill="var(--color-brand-600)" />
      <path d="M9 24l6-6 4 3.5L26.5 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26.5" cy="12" r="2.6" fill="var(--color-pink-300)" />
    </svg>
  );
}
