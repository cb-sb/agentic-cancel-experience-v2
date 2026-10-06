/**
 * Chargebee Copilot chrome, sampled from product screenshots (header, user
 * bubble, assistant body). Inline styles, so Tailwind cannot collapse them;
 * the hex is the fallback when no skin sets `--sk-*`. Read as CSS values only,
 * never by appending alpha digits.
 */
export const COPILOT_UI = {
  canvas: '#ffffff',
  header: 'var(--sk-slate-50, #fbfcfd)',
  title: 'var(--sk-slate-900, #111729)',
  muted: 'var(--sk-slate-500, #677488)',
  hairline: 'var(--sk-slate-100, #eef0f3)',
  userBubble: 'var(--sk-blue-50, #e7f1fe)',
  userText: 'var(--sk-blue-800, #183d7a)',
  botBubble: 'var(--sk-slate-100, #f4f6f9)',
  botBorder: 'var(--sk-slate-200, #e6e9ef)',
  botText: 'var(--sk-slate-900, #19191f)',
  botHeading: 'var(--sk-slate-900, #002b38)',
  send: 'var(--sk-blue-600, #377dff)',
} as const
