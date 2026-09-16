import { SCard, SIcon, type SIconName } from '@chargebee/sting-react'
import { useOrchestration } from '../store/useOrchestration'
import type { SetupDoor } from './copilotStage'

const DOORS: {
  id: Exclude<SetupDoor, 'acquire' | 'guide'>
  title: string
  body: string
  detail: string
  icon: SIconName
  well: string
  glyph: string
}[] = [
  {
    id: 'library',
    title: 'Ours',
    body: 'Start from a Chargebee posture. Copilot shows the step chain, then fills brand and targeting here.',
    detail: 'Fair save, click-to-cancel, plan change — labelled as the screens a subscriber walks.',
    icon: 'layout-template',
    well: 'bg-[#eef2ff]',
    glyph: 'text-[#4f46e5]',
  },
  {
    id: 'yours',
    title: 'Yours',
    body: 'Reuse a template you already scanned. Journeys and saved components stay in this merchant’s library.',
    detail: 'Confirmed uploads only. Attach a saved confirm or offer onto a Chargebee chain.',
    icon: 'layers',
    well: 'bg-[#ecfdf3]',
    glyph: 'text-[#047857]',
  },
  {
    id: 'upload',
    title: 'New',
    body: 'Scan a starter-kit upload. Copilot reviews the contract in chat, then saves it to Yours.',
    detail: 'Slots are pre-marked. Unmarked HTML is rejected, not guessed. Targeting stays in Copilot.',
    icon: 'cloud-upload',
    well: 'bg-[#eef2ff]',
    glyph: 'text-[#4f46e5]',
  },
]

export function BlankJourneyDoors() {
  const chooseDoor = useOrchestration((s) => s.chooseDoor)

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-auto px-xl py-xl">
      <div className="pointer-events-auto flex w-full max-w-[920px] flex-col items-center">
        <div className="flex w-full flex-wrap items-stretch justify-center gap-lg">
          {DOORS.map((door) => (
            <button
              key={door.id}
              type="button"
              onClick={() => chooseDoor(door.id)}
              className="group w-[268px] !cursor-pointer text-left transition-transform duration-200 hover:-translate-y-[6px] focus-visible:outline-none [&_*]:!cursor-pointer"
            >
              <SCard
                depth="flat"
                padding="large"
                rounded
                border="none"
                className="h-full min-h-[348px] !cursor-pointer overflow-hidden !rounded-[20px] !border-0 shadow-[0_8px_28px_rgba(15,23,42,0.08)] transition-[box-shadow] duration-200 group-hover:shadow-[0_20px_48px_rgba(15,23,42,0.14)] group-focus-visible:ring-2 group-focus-visible:ring-[#4f46e5]/30"
              >
                <SCard.Content>
                  <div className="flex min-h-[292px] flex-col">
                    <span
                      className={`mb-lg flex size-14 items-center justify-center rounded-[16px] transition-transform duration-200 group-hover:scale-[1.04] ${door.well}`}
                    >
                      <span className="flex size-10 items-center justify-center rounded-[12px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
                        <SIcon name={door.icon} size={20} className={door.glyph} />
                      </span>
                    </span>
                    <h2 className="text-[16px] font-semibold leading-snug tracking-tight text-slate-900">
                      {door.title}
                    </h2>
                    <p className="mt-xs text-[13.5px] leading-[1.55] text-slate-600">{door.body}</p>
                    <p className="mt-auto pt-st text-[12px] leading-[1.5] text-slate-400">
                      {door.detail}
                    </p>
                  </div>
                </SCard.Content>
              </SCard>
            </button>
          ))}
        </div>
        <p className="mt-[72px] text-center text-[13px] leading-relaxed text-slate-500">
          Not sure?{' '}
          <button
            type="button"
            onClick={() => chooseDoor('guide')}
            className="font-semibold text-[#4f46e5] underline decoration-[#c7d2fe] underline-offset-4 transition-colors hover:text-[#4338ca] hover:decoration-[#4f46e5]"
          >
            Copilot can pick a path
          </button>
          <span className="mx-[8px] text-slate-300">·</span>
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
