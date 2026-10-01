import { STUDIO, V8 } from '../../layout/layoutMode'
import { DevicePicker } from '../../render/DevicePicker'
import { useExperience } from '../../store/useExperience'
import { iconProps } from '../flow/icons'
import { FocusCard } from './FocusCard'
import { FocusChrome } from './FocusChrome'
import { DRAWER_IN_MS, DRAWER_OUT_MS, EASE_ENTER, EASE_LEAVE } from './tokens'
import { useFocusGeometry } from './useFocusGeometry'
import { VariantBar } from './VariantBar'
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
export function FocusOverlay({
  session,
  open,
  embedded = false,
}: {
  session: FocusSession
  open: boolean
  /** Fill the editor column. No scrim, no close — the step tabs are the navigation. */
  embedded?: boolean
}) {
  const { rightInset } = useFocusGeometry()
  const { order, at, go } = session

  if (embedded) {
    return (
      <div data-focus-overlay className="flex h-full min-h-0 flex-col bg-slate-100">
        {STUDIO && !V8 && <VariantBar experienceId={session.experience.id} />}
        <div className="relative min-h-0 flex-1">
          <FocusCard
            session={session}
            chrome={
              <>
                <EditorDevicePicker />
                <FocusChrome session={session} embedded floating />
              </>
            }
          />
          <StepArrow side="left" disabled={at <= 0} onClick={() => go(-1)} />
          <StepArrow side="right" disabled={at < 0 || at >= order.length - 1} onClick={() => go(1)} />
        </div>
      </div>
    )
  }

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
      <button
        type="button"
        onClick={session.exit}
        title="Close"
        aria-label="Close"
        className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/55 text-slate-700 shadow-[0_4px_16px_rgba(15,23,42,0.12)] backdrop-blur-[2px] transition-colors hover:bg-white/80 hover:text-slate-900 motion-reduce:transition-none"
        style={{
          opacity: open ? 1 : 0,
          transition: `opacity ${open ? DRAWER_IN_MS : DRAWER_OUT_MS}ms ${open ? EASE_ENTER : EASE_LEAVE}`,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <FocusChrome session={session} reserveClose />

      <div className="relative min-h-0 flex-1">
        <FocusCard session={session} />
        <StepArrow side="left" disabled={at <= 0} onClick={() => go(-1)} />
        <StepArrow side="right" disabled={at < 0 || at >= order.length - 1} onClick={() => go(1)} />
      </div>
    </div>
  )
}

function EditorDevicePicker() {
  const device = useExperience((s) => s.device)
  const setDevice = useExperience((s) => s.setDevice)
  return (
    <DevicePicker
      value={device}
      onChange={setDevice}
      label={(kind) => `Preview at ${kind} width`}
    />
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
