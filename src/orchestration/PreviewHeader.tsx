import { SButton } from '@chargebee/sting-react'
import { DeviceIcon, DEVICE_KINDS } from '../render/DevicePicker'
import { useExperience } from '../store/useExperience'
import { PlayIdentity, PublishControls } from './PlayHeader'

/**
 * The header while previewing: a way out, a way to look, and a way to start
 * again.
 *
 * Build's header is deliberately not reused. Sharing one made audience and
 * targeting reachable from a preview — settings for a play, offered while
 * standing inside it as a subscriber — and left `Save draft` on a screen where
 * nothing can be edited. What is left is the three things a preview is about,
 * plus the publish state, which is true of the play either way.
 *
 * Devices sit here rather than in Build for the same reason: choosing one is
 * choosing how to preview, and a device picked in Build is a setting for a
 * screen nobody is looking at.
 */
export function PreviewHeader() {
  const setMode = useExperience((s) => s.setMode)
  const resetSession = useExperience((s) => s.resetSession)
  const device = useExperience((s) => s.device)
  const setDevice = useExperience((s) => s.setDevice)

  return (
    <header className="relative flex h-14 flex-none items-center justify-between gap-4 border-b border-slate-200 bg-white px-5">
      <div className="flex min-w-0 items-center gap-3">
        {/* The way out comes first and is named for where it goes. A mode
            switch would imply the preview is a place you can configure. */}
        <button
          type="button"
          onClick={() => setMode('compose')}
          className="flex flex-none items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Close preview
        </button>
        <span className="h-6 w-px flex-none bg-slate-200" />
        <PlayIdentity />
      </div>

      {/* Centred on the screen rather than on what is left between its
          neighbours: the way out and the publish controls are nowhere near the
          same width, so a flex row put "centred" a hundred pixels to the right.
          Out of the flow entirely, and `pointer-events` handed back to the
          picker itself so the strip does not swallow clicks either side. */}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
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
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <DeviceIcon kind={kind} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-none items-center gap-2">
        <SButton size="small" variant="neutral-outline" onClick={resetSession}>
          Restart
        </SButton>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <PublishControls />
      </div>
    </header>
  )
}
