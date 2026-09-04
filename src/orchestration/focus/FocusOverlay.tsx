import { iconProps } from '../flow/icons'
import { FocusCard } from './FocusCard'
import { FocusChrome } from './FocusChrome'
import { DRAWER_IN_MS, DRAWER_OUT_MS, EASE_ENTER, EASE_LEAVE } from './tokens'
import { useFocusGeometry } from './useFocusGeometry'
import type { FocusSession } from './useFocusSession'

/**
 * Focus as a full surface: the card takes everything up to the settings pane,
 * the play sits behind a scrim.
 *
 * The trade this makes is fidelity over context. A 680px desktop card always
 * fits, at 1:1, with room around it — but the canvas is only a blur, so the
 * merchant's sense of where this card sits comes from the step strip in the
 * toolbar rather than from seeing the flow. Whether that is enough is the thing
 * the drawer variant exists to test.
 */
export function FocusOverlay({ session, open }: { session: FocusSession; open: boolean }) {
  const { rightInset } = useFocusGeometry()
  const { order, at, go } = session

  return (
    <div
      data-focus-overlay
      className="absolute inset-y-0 left-0 z-40 flex flex-col bg-slate-100/85 backdrop-blur-[3px] motion-reduce:transition-none"
      style={{
        right: rightInset,
        opacity: open ? 1 : 0,
        transition: `opacity ${open ? DRAWER_IN_MS : DRAWER_OUT_MS}ms ${
          open ? EASE_ENTER : EASE_LEAVE
        }`,
      }}
    >
      <FocusChrome session={session} />

      <div className="relative min-h-0 flex-1">
        <FocusCard session={session} />
        <StepArrow side="left" disabled={at <= 0} onClick={() => go(-1)} />
        <StepArrow side="right" disabled={at < 0 || at >= order.length - 1} onClick={() => go(1)} />
      </div>
    </div>
  )
}

function StepArrow({
  side,
  disabled,
  onClick,
}: {
  side: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={side === 'left' ? 'Previous card (←)' : 'Next card (→)'}
      aria-label={side === 'left' ? 'Previous card' : 'Next card'}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-opacity hover:text-slate-900 disabled:pointer-events-none disabled:opacity-0 ${
        side === 'left' ? 'left-4' : 'right-4'
      }`}
    >
      <svg {...iconProps} width={17} height={17}>
        <path d={side === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  )
}
