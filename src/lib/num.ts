/** Number formatting shared by the agent's question hints and plan card. */

/** 0.184 → "18%" */
export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`
}

/** [0.18, 0.22] → "18–22%" (en dash, as the copy deck asks). */
export function pctRange([lo, hi]: [number, number], digits = 0): string {
  return `${(lo * 100).toFixed(digits)}–${(hi * 100).toFixed(digits)}%`
}

/** 12480 → "$12,480"; 940 → "$940". */
export function money(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`
}

/** [8200, 11400] → "$8,200–$11,400". */
export function moneyRange([lo, hi]: [number, number]): string {
  return `${money(lo)}–${money(hi)}`
}

/** 13180 → "13,180". */
export function count(v: number): string {
  return Math.round(v).toLocaleString('en-US')
}
