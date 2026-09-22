import { useMemo } from 'react'
import { buildSrcdoc } from './ArtifactPlayer'

/** Scaled-down hosted chrome so two surveys of the same kind still look different. */
export function ChromeThumb({
  html,
  css,
  label,
}: {
  html: string
  css?: string
  label: string
}) {
  const srcdoc = useMemo(() => buildSrcdoc(html, css), [html, css])
  return (
    <div
      className="relative overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50"
      style={{ height: 118 }}
    >
      <iframe
        title={label}
        srcDoc={srcdoc}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
        style={{ width: 400, height: 260, transform: 'scale(0.48)' }}
      />
    </div>
  )
}
