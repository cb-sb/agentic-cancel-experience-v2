import { SCard, SIcon, type SIconName } from '@chargebee/sting-react'
import { useOrchestration } from '../store/useOrchestration'

function DoorShell({
  title,
  body,
  detail,
  icon,
  well,
  glyph,
}: {
  title: string
  body: string
  detail: string
  icon: SIconName
  well: string
  glyph: string
}) {
  return (
    <SCard
      depth="flat"
      padding="large"
      rounded
      border="none"
      className="h-full min-h-[348px] overflow-hidden !rounded-[20px] !border-0 shadow-[0_8px_28px_rgba(15,23,42,0.08)] transition-[box-shadow] duration-200 group-hover:shadow-[0_20px_48px_rgba(15,23,42,0.14)] group-focus-visible:ring-2 group-focus-visible:ring-[#4f46e5]/30"
    >
      <SCard.Content>
        <div className="flex min-h-[292px] flex-col">
          <span
            className={`mb-lg flex size-14 items-center justify-center rounded-[16px] transition-transform duration-200 group-hover:scale-[1.04] ${well}`}
          >
            <span className="flex size-10 items-center justify-center rounded-[12px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
              <SIcon name={icon} size={20} className={glyph} />
            </span>
          </span>
          <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-slate-900">{title}</h2>
          <p className="mt-xs text-[13.5px] leading-[1.55] text-slate-600">{body}</p>
          <p className="mt-auto pt-st text-[12px] leading-[1.5] text-slate-400">{detail}</p>
        </div>
      </SCard.Content>
    </SCard>
  )
}

export function BlankJourneyDoors() {
  const chooseDoor = useOrchestration((s) => s.chooseDoor)
  const openTemplates = useOrchestration((s) => s.openTemplates)

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-auto px-xl py-xl">
      <div className="pointer-events-auto flex w-full max-w-[920px] flex-col items-center">
        <div className="flex w-full flex-wrap items-stretch justify-center gap-lg">
          <button
            type="button"
            onClick={() => openTemplates('ours')}
            className="group w-[268px] !cursor-pointer text-left transition-transform duration-200 hover:-translate-y-[6px] focus-visible:outline-none [&_*]:!cursor-pointer"
          >
            <DoorShell
              title="Start with a template"
              body="Pick a Chargebee posture, or reopen chrome you already scanned."
              detail="Opens Chargebee templates. My templates is a tab in the same library."
              icon="layout-template"
              well="bg-[#eef2ff]"
              glyph="text-[#4f46e5]"
            />
          </button>

          <button
            type="button"
            onClick={() => chooseDoor('upload')}
            className="group w-[268px] !cursor-pointer text-left transition-transform duration-200 hover:-translate-y-[6px] focus-visible:outline-none [&_*]:!cursor-pointer"
          >
            <DoorShell
              title="Upload a template"
              body="Get the starter kit, design the HTML, then drop the marked file here."
              detail="Download or copy for your LLM first. Unmarked HTML is rejected, not guessed."
              icon="cloud-upload"
              well="bg-[#eef2ff]"
              glyph="text-[#4f46e5]"
            />
          </button>

          <button
            type="button"
            onClick={() => chooseDoor('guide')}
            className="group w-[268px] !cursor-pointer text-left transition-transform duration-200 hover:-translate-y-[6px] focus-visible:outline-none [&_*]:!cursor-pointer"
          >
            <DoorShell
              title="Help me start"
              body="Don’t make me think. Copilot asks the job, then recommends a path."
              detail="A few short questions, then a recommended chain you can walk as a subscriber."
              icon="sparkles"
              well="bg-[#f5f3ff]"
              glyph="text-[#6d28d9]"
            />
          </button>
        </div>
        <p className="mt-[72px] text-center text-[13px] leading-relaxed text-slate-500">
          Acquiring?{' '}
          <button
            type="button"
            onClick={() => chooseDoor('acquire')}
            className="font-semibold text-[#4f46e5] underline decoration-[#c7d2fe] underline-offset-4 transition-colors hover:text-[#4338ca] hover:decoration-[#4f46e5]"
          >
            Pricing table → hosted checkout
          </button>
        </p>
      </div>
    </div>
  )
}
