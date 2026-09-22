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

export function BlankJourneyDoors({ packed = false }: { packed?: boolean }) {
  const chooseDoor = useOrchestration((s) => s.chooseDoor)
  const openTemplates = useOrchestration((s) => s.openTemplates)

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex overflow-auto px-xl py-xl ${
        packed ? 'items-start justify-start pt-[48px]' : 'items-center justify-center'
      }`}
    >
      <div
        className={`pointer-events-auto flex w-full flex-col ${
          packed ? 'items-start gap-[28px]' : 'max-w-[920px] items-center gap-[40px]'
        }`}
      >
        <div className={`max-w-[920px] ${packed ? 'text-left' : 'text-center'}`}>
          <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-slate-900">
            Start a cancel experience
          </h1>
          <p className="mt-xs text-[13.5px] leading-[1.55] text-slate-500">
            Pick a path. You’ll get a subscriber journey you can walk before anything goes live.
          </p>
        </div>
        <div
          className={`flex flex-wrap items-stretch gap-lg ${
            packed ? 'justify-start' : 'w-full justify-center'
          }`}
        >
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
              body="Download the Growth kit, compose an experience with your LLM, then drop the marked HTML."
              detail="One catalog of primitives — not a prescribed journey. Unmarked HTML is rejected, not guessed."
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
      </div>
    </div>
  )
}
