/** Web app manifest; `base` must match Vite's base so installs keep one stable URL. */
export function makeManifest(base: string) {
  const icon = (file: string, size: number, purpose?: 'maskable') => ({
    src: `${base}icons/${file}`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    ...(purpose ? { purpose } : {}),
  })
  return {
    name: 'Time Clock',
    short_name: 'Time Clock',
    description: 'Log work hours and expenses, see the weekly balance, and share a report.',
    display: 'standalone' as const,
    orientation: 'portrait' as const,
    start_url: base,
    scope: base,
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [icon('icon-192.png', 192), icon('icon-512.png', 512), icon('icon-maskable-512.png', 512, 'maskable')],
  }
}
