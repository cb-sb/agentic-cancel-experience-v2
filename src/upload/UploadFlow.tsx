import { landUploadedPlan } from '../orchestration/copilotThread'
import { useCopilotStage } from '../orchestration/copilotStage'
import { ConfirmManifest } from './ConfirmManifest'
import { UploadTemplate } from './UploadTemplate'
import { useUpload } from './useUpload'

export function UploadFlow() {
  const phase = useUpload((s) => s.phase)
  const close = useUpload((s) => s.close)
  const stage = useCopilotStage()
  if (phase === 'closed' || stage === 'center') return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={close} />
      <div className="relative flex max-h-[min(860px,90vh)] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <header className="flex flex-none items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">
              {phase === 'confirm' ? 'Confirm template' : 'Upload my own template'}
            </h2>
            <p className="text-[12px] text-slate-500">Chargebee hosts chrome. Growth owns the slots.</p>
          </div>
            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden p-5">
          {phase === 'pick' ? <UploadTemplate /> : <ConfirmManifest onConfirmed={landUploadedPlan} />}
        </div>
      </div>
    </div>
  )
}
