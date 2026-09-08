export const COPILOT_ICON_SRC = '/copilot-icon.png'

/** Chargebee Copilot mark — the collapsed launcher, and the empty-state hero. */
export function CopilotMark({
  size = 48,
  className = '',
  alt = '',
}: {
  size?: number
  className?: string
  alt?: string
}) {
  return (
    <img
      src={COPILOT_ICON_SRC}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      draggable={false}
    />
  )
}
