export function formatUSD(cents: number): string {
  const neg = cents < 0
  const abs = Math.abs(Math.round(cents))
  const dollars = Math.floor(abs / 100)
  const rem = String(abs % 100).padStart(2, '0')
  const withCommas = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${neg ? '-' : ''}$${withCommas}.${rem}`
}

export function parseUSD(text: string): number | null {
  const cleaned = text.trim().replace(/^\$/, '').replace(/,/g, '')
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(cleaned)) return null
  const cents = Math.round(parseFloat(cleaned) * 100)
  return cents > 0 ? cents : null
}
