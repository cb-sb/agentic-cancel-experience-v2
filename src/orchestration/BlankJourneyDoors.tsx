import { SCard, SIcon, type SIconName } from '@chargebee/sting-react'
import { CONCIERGE, V8 } from '../layout/layoutMode'
import { sendAs } from '../agent/chats'
import { useAgentStore } from '../agent/useAgentStore'
import { useWorkspace } from '../workspace/useWorkspace'
import { useOrchestration } from '../store/useOrchestration'
import { startUploadPage } from '../workspace/useWorkspace'

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
            className={`mb-4 flex size-14 items-center justify-center rounded-[16px] transition-transform duration-200 group-hover:scale-[1.04] ${well}`}
          >
            <span className="flex size-10 items-center justify-center rounded-[12px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
              <SIcon name={icon} size={20} className={glyph} />
            </span>
          </span>
          <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-slate-900">{title}</h2>
          <p className="mt-1 text-[13.5px] leading-[1.55] text-slate-600">{body}</p>
          <p className="mt-auto pt-3 text-[12px] leading-[1.5] text-slate-400">{detail}</p>
        </div>
      </SCard.Content>
    </SCard>
  )
}

/** Three shippable starts; Copilot is only the third door. v8 has two starts and no Copilot door. */
export function BlankJourneyDoors({ packed = false }: { packed?: boolean }) {
  const chooseDoor = useOrchestration((s) => s.chooseDoor)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  if (CONCIERGE) return <ConciergeDoors />

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex overflow-auto px-8 py-8 ${
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
          <p className="mt-1 text-[13.5px] leading-[1.55] text-slate-500">
            Pick a path. You’ll get a subscriber journey you can walk before anything goes live.
          </p>
        </div>
        <div
          className={`flex flex-wrap items-stretch gap-4 ${
            packed ? 'justify-start' : 'w-full justify-center'
          }`}
        >
          <button
            type="button"
            onClick={() => openTemplates('ours')}
            className="group w-[268px] cursor-pointer text-left transition-transform duration-200 hover:-translate-y-[6px] focus-visible:outline-none"
          >
            <DoorShell
              title="Start with a template"
              body="Pick a Chargebee posture, or reopen chrome you already scanned."
              detail={
                V8
                  ? 'Opens Templates and components.'
                  : 'Opens Chargebee templates. My templates is a tab in the same library.'
              }
              icon="layout-template"
              well="bg-[#eef2ff]"
              glyph="text-[#4f46e5]"
            />
          </button>

          <button
            type="button"
            onClick={() => (V8 ? startUploadPage() : chooseDoor('upload'))}
            className="group w-[268px] cursor-pointer text-left transition-transform duration-200 hover:-translate-y-[6px] focus-visible:outline-none"
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

          {!V8 && (
            <button
              type="button"
              onClick={() => chooseDoor('guide')}
              className="group w-[268px] cursor-pointer text-left transition-transform duration-200 hover:-translate-y-[6px] focus-visible:outline-none"
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
          )}
        </div>
      </div>
    </div>
  )
}

/** Concierge: the three starts for a cancel page. Upload and Copilot both carry on in the chat. */
function ConciergeDoors() {
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const chooseDoor = useOrchestration((s) => s.chooseDoor)
  const inChat = (door: 'upload' | 'guide', text: string) => {
    const chatId = useAgentStore.getState().ensureChat(`cancel:${useWorkspace.getState().activeId}`)
    chooseDoor(door)
    sendAs(chatId, text)
  }
  const doors = [
    {
      title: 'Start with a template',
      body: 'Pick a proven cancel page and change what you need.',
      detail: 'Opens Templates. Copilot takes it from there.',
      icon: 'layout-template' as const,
      onClick: () => openTemplates('ours'),
    },
    {
      title: 'Upload your own design',
      body: 'Build your pages with your LLM and the Growth kit, then drop them in the chat.',
      detail: 'Copilot walks you through the kit, the upload and a check of every screen.',
      icon: 'cloud-upload' as const,
      onClick: () => inChat('upload', 'I want to upload my own design.'),
    },
    {
      title: 'Start with Copilot',
      body: 'Tell Copilot what you want. It picks the screens and writes the copy.',
      detail: 'A question or two, then a cancel page you can walk as a subscriber.',
      icon: 'sparkles' as const,
      onClick: () => inChat('guide', 'Help me build this cancel page.'),
    },
  ]
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-auto px-8 py-8">
      <div className="pointer-events-auto flex w-full max-w-[920px] flex-col items-center gap-[40px]">
        <div className="text-center">
          <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-slate-900">Start a cancel page</h1>
          <p className="mt-1 text-[13.5px] leading-[1.55] text-slate-500">
            Pick a way in. You can walk it as a subscriber before anything goes live.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-stretch justify-center gap-4">
          {doors.map((d) => (
            <button
              key={d.title}
              type="button"
              onClick={d.onClick}
              className="group w-[268px] cursor-pointer text-left transition-transform duration-200 hover:-translate-y-[6px] focus-visible:outline-none"
            >
              <DoorShell title={d.title} body={d.body} detail={d.detail} icon={d.icon} well="bg-[#eef2ff]" glyph="text-[#4f46e5]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
