import { useEffect, useRef, type ReactNode } from 'react'
import { useOrchestration } from '../store/useOrchestration'
import { SPOTLIGHT_LABEL, type SpotlightId } from './spotlight'
import { useLookTarget } from './useLookTarget'

export function SpotlightFrame({
  id,
  label,
  children,
  className,
}: {
  id: SpotlightId
  /** Override the default “Look at …” chip. Empty string hides it. */
  label?: string
  children: ReactNode
  className?: string
}) {
  const active = useLookTarget() === id
  const nonce = useOrchestration((s) => s.spotlightNonce)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, [active, nonce])

  const chip = label === '' ? null : (label ?? SPOTLIGHT_LABEL[id])

  return (
    <div
      ref={ref}
      data-spotlight={id}
      data-spotlight-on={active || undefined}
      className={`relative ${className ?? ''}`}
    >
      <div className={active ? 'cb-spotlight-ring rounded-[16px]' : undefined}>{children}</div>
      {active && chip && (
        <span className="cb-spotlight-label" role="status">
          {chip}
        </span>
      )}
    </div>
  )
}
