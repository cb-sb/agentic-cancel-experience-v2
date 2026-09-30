import { useEffect, useState } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { landUploadedPlan } from '../orchestration/copilotThread'
import { BackButton } from '../shell/BackButton'
import { useOrchestration } from '../store/useOrchestration'
import { ConfirmManifest } from './ConfirmManifest'
import { copyKitForLlm, downloadKit, UploadDrop } from './UploadTemplate'
import { useUpload } from './useUpload'
import { WizardBody, WizardFooter, WizardStepper } from './Wizard'

type View = 'kit' | 'drop'

const STEPS = ['Get the kit', 'Upload your pages', 'Check and save']

function KitTask({
  n,
  done,
  title,
  body,
  action,
}: {
  n: number
  done: boolean
  title: string
  body: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-[14px] border-t border-slate-100 px-[16px] py-[16px] first:border-t-0">
      <span
        className={`mt-[1px] flex h-[24px] w-[24px] flex-none items-center justify-center rounded-full text-[12px] font-semibold tabular-nums ${
          done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {done ? <SIcon name="check" size={13} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-[#19191f]">{title}</p>
        <p className="mt-[2px] text-[12.5px] leading-[1.55] text-[#677488]">{body}</p>
      </div>
      {action && <div className="flex flex-none items-center self-center">{action}</div>}
    </li>
  )
}

function KitStep({ onNext, onMyTemplates }: { onNext: () => void; onMyTemplates: () => void }) {
  const [downloaded, setDownloaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [justCopied, setJustCopied] = useState(false)

  const copy = async () => {
    if (!(await copyKitForLlm())) return
    setCopied(true)
    setJustCopied(true)
    window.setTimeout(() => setJustCopied(false), 1800)
  }

  return (
    <>
      <WizardBody title="Get the Growth kit" description="Your LLM builds your cancel pages from the kit. Then you upload them here.">
        <ol className="rounded-[12px] border border-slate-200 bg-white">
          <KitTask
            n={1}
            done={downloaded}
            title="Download the kit"
            body="A zip with screen building blocks, styles and a guide for your LLM."
            action={
              <SButton
                size="small"
                variant={downloaded ? 'neutral-outline' : 'primary'}
                className="w-auto shrink-0"
                onClick={() => {
                  downloadKit()
                  setDownloaded(true)
                }}
              >
                {downloaded ? 'Download again' : 'Download kit'}
              </SButton>
            }
          />
          <KitTask
            n={2}
            done={copied}
            title="Give it to your LLM"
            body={
              <>
                Attach the zip, or copy the kit and paste it. Tell it the cancel experience you want and to keep every{' '}
                <code className="rounded bg-slate-100 px-1 text-[11.5px]">data-cb-*</code> mark.
              </>
            }
            action={
              <SButton size="small" variant="neutral-outline" className="w-auto shrink-0" onClick={() => void copy()}>
                {justCopied ? 'Copied' : 'Copy for your LLM'}
              </SButton>
            }
          />
          <KitTask n={3} done={false} title="Upload the pages it builds" body="You do this in the next step." />
        </ol>
        <p className="mt-[16px] text-[12.5px] text-slate-500">
          Uploaded one before?{' '}
          <button
            type="button"
            onClick={onMyTemplates}
            className="font-semibold text-[#4f46e5] underline decoration-[#c7d2fe] underline-offset-2 hover:text-[#4338ca]"
          >
            Open saved components
          </button>
        </p>
      </WizardBody>
      <WizardFooter
        right={
          downloaded ? (
            <SButton size="small" variant="primary" className="w-auto shrink-0" onClick={onNext}>
              Continue
            </SButton>
          ) : (
            <SButton size="small" variant="neutral-outline" className="w-auto shrink-0" onClick={onNext}>
              I’ve already built my cancel experience with the Growth kit
            </SButton>
          )
        }
      />
    </>
  )
}

function DropStep({ onBack }: { onBack: () => void }) {
  return (
    <>
      <WizardBody title="Upload your pages" description="Add the HTML or zip your LLM made. We check it for the kit’s marks.">
        <UploadDrop bare />
      </WizardBody>
      <WizardFooter
        left={
          <SButton size="small" variant="neutral-outline" className="w-auto shrink-0" onClick={onBack}>
            Back
          </SButton>
        }
        right={<span className="text-[12.5px] text-slate-400">Add your file to continue</span>}
      />
    </>
  )
}

/** v8: upload runs as a wizard page. Copilot starts once the file is saved and the editor opens. */
export function UploadPage() {
  const phase = useUpload((s) => s.phase)
  const close = useUpload((s) => s.close)
  const backToPick = useUpload((s) => s.backToPick)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const [view, setView] = useState<View>('kit')

  const back = () => {
    if (phase === 'confirm') {
      backToPick()
      setView('drop')
    } else if (view === 'drop') setView('kit')
    else close()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const active = phase === 'confirm' ? 2 : view === 'drop' ? 1 : 0

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-50">
      <div className="flex h-[60px] flex-none items-center gap-[10px] border-b border-slate-200 bg-white px-[20px]">
        <BackButton onBack={close} />
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-slate-900">Upload a template</h2>
          <p className="text-[12px] text-slate-500">Use pages you built with the Growth kit.</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden px-[24px] py-[32px]">
        <section
          aria-label="Upload a template"
          className="flex max-h-full min-h-[min(440px,100%)] w-full max-w-[760px] flex-col overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.12)]"
        >
          <div className="flex-none border-b border-slate-100 px-[28px] py-[18px]">
            <WizardStepper steps={STEPS} active={active} />
          </div>
          {phase === 'confirm' ? (
            <ConfirmManifest onConfirmed={landUploadedPlan} wizard={{ onBack: back }} />
          ) : view === 'drop' ? (
            <DropStep onBack={back} />
          ) : (
            <KitStep
              onNext={() => setView('drop')}
              onMyTemplates={() => {
                close()
                openTemplates('yours')
              }}
            />
          )}
        </section>
      </div>
    </div>
  )
}
