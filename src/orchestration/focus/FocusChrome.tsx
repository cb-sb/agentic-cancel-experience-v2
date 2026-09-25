import { tabLabel } from '../../lib/stepLabels'
import { DevicePicker } from '../../render/DevicePicker'
import { useExperience } from '../../store/useExperience'
import { iconProps } from '../flow/icons'
import { StepSwitcher } from '../StepSwitcher'
import type { FocusSession } from './useFocusSession'

/**
 * The focus toolbar. Three zones, left to right: the way out, what you are
 * editing, and how you are viewing it.
 *
 * `dense` is for the drawer, which has roughly 740px to spend and cannot hold a
 * tab per step. It trades the strip for a counter and a pair of arrows — the
 * same navigation, named rather than laid out — and the canvas beside it is
 * doing the job the strip does in the overlay.
 */
export function FocusChrome({
  session,
  dense = false,
  reserveClose = false,
  embedded = false,
  floating = false,
}: {
  session: FocusSession
  dense?: boolean
  /** Room for the overlay's top-right close button. */
  reserveClose?: boolean
  /** The editor is the page. There is no canvas underneath to go back to. */
  embedded?: boolean
  /** Sit on the card, the same width, instead of a full-width bar. */
  floating?: boolean
}) {
  const device = useExperience((s) => s.device)
  const setDevice = useExperience((s) => s.setDevice)
  const { experience, position, order, at, go, exit } = session

  return (
    <div
      className={
        floating
          ? 'flex w-max max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm'
          : `flex h-14 flex-none items-center gap-2 border-b border-slate-200 bg-white pl-3 ${
              reserveClose && !embedded ? 'pr-16' : 'pr-3'
            }`
      }
    >
      {!embedded && (
        <button
          type="button"
          onClick={exit}
          title="Back to the play (Esc)"
          aria-label="Back to the play"
          className="group flex h-8 flex-none items-center gap-1.5 rounded-lg pl-1.5 pr-2 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <svg {...iconProps} width={15} height={15}>
            <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
          </svg>
          {dense ? 'Back' : 'Back to play'}
          <kbd className="rounded border border-slate-200 px-1 font-sans text-[9px] font-semibold text-slate-400 transition-colors group-hover:border-slate-300">
            esc
          </kbd>
        </button>
      )}

      {!embedded && <span className="h-6 w-px flex-none bg-slate-200" aria-hidden />}

      {dense ? (
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
          <ArrowButton side="left" disabled={at <= 0} onClick={() => go(-1)} />
          <span className="truncate px-1 text-[12px] font-semibold text-slate-700">
            {tabLabel(session.step)}
          </span>
          <span className="flex-none text-[11px] font-medium tabular-nums text-slate-400">
            {position.index + 1}/{position.total}
          </span>
          <ArrowButton
            side="right"
            disabled={at < 0 || at >= order.length - 1}
            onClick={() => go(1)}
          />
        </div>
      ) : (
        <nav
          aria-label="Steps in this experience"
          className={`no-scrollbar min-w-0 overflow-x-auto py-1 ${floating ? '' : 'flex-1'}`}
        >
          <StepSwitcher experience={experience} />
        </nav>
      )}

      {!floating && <span className="h-6 w-px flex-none bg-slate-200" aria-hidden />}

      {!floating && (
        <DevicePicker
          value={device}
          onChange={setDevice}
          label={(kind) => `Preview at ${kind} width`}
        />
      )}
    </div>
  )
}

function ArrowButton({
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
      className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-30"
    >
      <svg {...iconProps} width={15} height={15}>
        <path d={side === 'left' ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  )
}
