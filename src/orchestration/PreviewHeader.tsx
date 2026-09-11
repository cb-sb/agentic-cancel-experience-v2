import { SButton } from '@chargebee/sting-react'
import { DeviceIcon, DEVICE_KINDS } from '../render/DevicePicker'
import { DeviceChrome } from '../render/DeviceChrome'
import { PlayerShell } from '../runtime/PlayerShell'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'

/**
 * Subscriber preview as a stage over the canvas, not a separate page.
 *
 * Stacking (always): Preview on top, the step-edit drawer under it if that
 * drawer was already open, the workflow graph last. A light gray frost cuts
 * distraction without hiding the play around the device. Close lives on the
 * wash — a circular X on the right — rather than in the play toolbar.
 */
export function PreviewOverlay() {
  const setMode = useExperience((s) => s.setMode)
  const resetSession = useExperience((s) => s.resetSession)
  const device = useExperience((s) => s.device)
  const setDevice = useExperience((s) => s.setDevice)
  const brandName = useExperience((s) => s.experience.branding.merchantName)
  const shell = useExperience((s) => s.experience.shell)
  const uploaded = useJourney((s) => s.file.source === 'uploaded')

  return (
    <div className="absolute inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-zinc-500/25 backdrop-blur-[6px]" aria-hidden />

      <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
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
        className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/55 text-slate-700 shadow-[0_4px_16px_rgba(15,23,42,0.12)] backdrop-blur-[2px] transition-colors hover:bg-white/80 hover:text-slate-900"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="relative z-10 h-full px-20 pb-10 pt-16">
        <DeviceChrome device={device} brandName={brandName} fullBleed={uploaded || shell !== 'modal'}>
          <PlayerShell />
        </DeviceChrome>
      </div>
    </div>
  )
}
