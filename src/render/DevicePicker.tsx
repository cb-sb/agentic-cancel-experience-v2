import type { DeviceKind } from '../store/useExperience'

export const DEVICE_KINDS: DeviceKind[] = ['desktop', 'tablet', 'mobile']

export function DeviceIcon({ kind, size = 15 }: { kind: DeviceKind; size?: number }) {
  const p = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (kind === 'desktop')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...p}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    )
  if (kind === 'tablet')
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...p}>
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 18h.01" />
      </svg>
    )
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...p}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  )
}

/**
 * The one device control. Three hosts show it — the play header, the focus
 * toolbar and the legacy composer — and they differ only in what selecting a
 * device means, so only the callback varies.
 *
 * `value` is nullable because the play header shows the picker while Build is
 * active, where no device is in effect yet and highlighting one would claim
 * otherwise.
 */
export function DevicePicker({
  value,
  onChange,
  label = (kind) => kind,
}: {
  value: DeviceKind | null
  onChange: (kind: DeviceKind) => void
  /** Tooltip per device, so a host can say what picking one will do. */
  label?: (kind: DeviceKind) => string
}) {
  return (
    <div className="flex flex-none items-center gap-0.5 rounded-xl bg-slate-100/80 p-0.5 ring-1 ring-slate-200/70">
      {DEVICE_KINDS.map((kind) => {
        const active = value === kind
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onChange(kind)}
            title={label(kind)}
            aria-label={label(kind)}
            aria-pressed={active}
            className={`flex h-8 w-8 items-center justify-center rounded-lg capitalize transition-colors ${
              active
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-200'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <DeviceIcon kind={kind} />
          </button>
        )
      })}
    </div>
  )
}
