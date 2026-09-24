import { SButton } from '@chargebee/sting-react'
import { DeviceIcon, DEVICE_KINDS } from '../render/DevicePicker'
import { DeviceChrome } from '../render/DeviceChrome'
import { PlayerShell } from '../runtime/PlayerShell'
import { EASE_ENTER, EASE_LEAVE } from '../lib/motion'
import { usePresence } from '../lib/usePresence'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'

/**
 * Arrival/exit for the preview.
 *
 * Preview isn't a separate page — it's the screen you're editing coming to
 * life. So the device lifts up out of the canvas (a small rise + scale-up) as
 * the frost settles in behind it, then eases to rest. Closing reverses it: the
 * device sinks back down into the workspace it came from. The curve decelerates
 * on the way in so it looks like it settles, and is quicker leaving.
 */
const PREVIEW_IN_MS = 340
const PREVIEW_OUT_MS = 220

/**
 * Subscriber preview as a stage over the canvas, not a separate page.
 *
 * Stacking (always): Preview on top, the step-edit drawer under it if that
 * drawer was already open, the workflow graph last. A light gray frost cuts
 * distraction without hiding the play around the device. Close lives on the
 * wash — a circular X on the right — rather than in the play toolbar.
 */
export function PreviewOverlay() {
  const previewing = useExperience((s) => s.mode === 'play')
  const setMode = useExperience((s) => s.setMode)
  const resetSession = useExperience((s) => s.resetSession)
  const device = useExperience((s) => s.device)
  const setDevice = useExperience((s) => s.setDevice)
  const brandName = useExperience((s) => s.experience.branding.merchantName)
  const shell = useExperience((s) => s.experience.shell)
  const uploaded = useJourney((s) => s.file.source === 'uploaded')

  const { alive, open } = usePresence(previewing, PREVIEW_OUT_MS)
  if (!alive) return null

  const ms = open ? PREVIEW_IN_MS : PREVIEW_OUT_MS
  const ease = open ? EASE_ENTER : EASE_LEAVE
  const fade = `opacity ${ms}ms ${ease}`
  const rise = `opacity ${ms}ms ${ease}, transform ${ms}ms ${ease}`

  return (
    <div
      className="absolute inset-0 z-50 overflow-hidden"
      style={{ pointerEvents: previewing ? 'auto' : 'none' }}
    >
      <div
        className="absolute inset-0 bg-zinc-500/25 backdrop-blur-[6px] motion-reduce:transition-none"
        aria-hidden
        style={{ opacity: open ? 1 : 0, transition: fade }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center motion-reduce:transition-none"
        style={{ opacity: open ? 1 : 0, transform: `translateY(${open ? 0 : -8}px)`, transition: rise }}
      >
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/50 bg-white/35 px-1.5 py-1 shadow-sm backdrop-blur-[2px]">
          <div className="flex items-center gap-0.5 p-0.5">
            {DEVICE_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setDevice(kind)}
                title={`Preview on ${kind}`}
                aria-label={`Preview on ${kind}`}
                aria-pressed={device === kind}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  device === kind
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
                }`}
              >
                <DeviceIcon kind={kind} />
              </button>
            ))}
          </div>
          <SButton size="small" variant="neutral-outline" onClick={resetSession}>
            Restart
          </SButton>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMode('compose')}
        title="Close preview"
        aria-label="Close preview"
        className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/55 text-slate-700 shadow-[0_4px_16px_rgba(15,23,42,0.12)] backdrop-blur-[2px] transition-colors hover:bg-white/80 hover:text-slate-900 motion-reduce:transition-none"
        style={{ opacity: open ? 1 : 0, transition: fade }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div
        className="relative z-10 h-full px-20 pb-10 pt-16 motion-reduce:transition-none"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(16px)',
          transformOrigin: 'center 42%',
          transition: rise,
        }}
      >
        <DeviceChrome device={device} brandName={brandName} fullBleed={uploaded || shell !== 'modal'}>
          <PlayerShell />
        </DeviceChrome>
      </div>
    </div>
  )
}
