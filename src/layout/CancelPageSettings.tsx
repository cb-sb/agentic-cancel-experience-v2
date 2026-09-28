import { useEffect } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { orderedThreads, useWorkspace } from '../workspace/useWorkspace'

/** Retention settings that apply to every Cancel Page play at once. */
export function CancelPageSettings() {
  const open = useCancelSettings((s) => s.settingsOpen)
  const setOpen = useCancelSettings((s) => s.setSettingsOpen)
  const globalControl = useCancelSettings((s) => s.globalControl)
  const setGlobalControl = useCancelSettings((s) => s.setGlobalControl)
  const fallbackId = useCancelSettings((s) => s.globalFallbackId)
  const setFallback = useCancelSettings((s) => s.setGlobalFallback)
  const threads = useWorkspace((s) => s.threads)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  const choices = orderedThreads(threads).filter((t) => t.title !== 'New experience')

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/30" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Cancel page settings"
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-[24px] py-[18px]">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Cancel page settings</h2>
            <p className="mt-[2px] text-[13px] text-slate-500">These apply to every cancel experience.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <SIcon name="x" size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-[22px] px-[24px] py-[20px]">
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="global-control" className="text-[13.5px] font-semibold text-slate-900">
                Global control
              </label>
              <span className="text-[13px] tabular-nums text-slate-600">{globalControl === 0 ? 'Off' : `${globalControl}%`}</span>
            </div>
            <p className="mt-[2px] text-[12.5px] leading-relaxed text-slate-500">
              A share of everyone who clicks Cancel sees no cancel page. Compare them with everyone else to see how many
              subscribers your cancel pages keep.
            </p>
            <input
              id="global-control"
              type="range"
              min={0}
              max={30}
              step={1}
              value={globalControl}
              onChange={(e) => setGlobalControl(Number(e.target.value))}
              className="mt-[10px] w-full accent-slate-800"
            />
          </div>

          <div>
            <label htmlFor="global-fallback" className="text-[13.5px] font-semibold text-slate-900">
              Global fallback
            </label>
            <p className="mt-[2px] text-[12.5px] leading-relaxed text-slate-500">
              The cancel experience for subscribers that no other cancel experience's audience matches.
            </p>
            <select
              id="global-fallback"
              value={fallbackId ?? ''}
              onChange={(e) => setFallback(e.target.value || null)}
              className="mt-[10px] w-full rounded-lg border border-slate-200 bg-white px-[10px] py-[7px] text-[13px] text-slate-800 outline-none hover:border-slate-300 focus:border-slate-400"
            >
              <option value="">None, cancel with no cancel page</option>
              {choices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-[24px] py-[14px]">
          <SButton size="small" variant="primary" className="w-auto" onClick={() => setOpen(false)}>
            Done
          </SButton>
        </div>
      </div>
    </div>
  )
}
