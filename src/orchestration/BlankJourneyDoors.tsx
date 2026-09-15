import { SCard } from '@chargebee/sting-react'
import { useOrchestration } from '../store/useOrchestration'
import type { SetupDoor } from './copilotStage'
import gridUrl from './assets/copilot-grid.svg'
import uploadUrl from './assets/copilot-upload.svg'

const DOORS: {
  id: Exclude<SetupDoor, 'acquire'>
  title: string
  body: string
  detail: string
  icon: string
  iconBox: string
}[] = [
  {
    id: 'upload',
    title: 'Upload my own template',
    body: 'HTML or a zip of static pages. Mark sections with data-cb-step. CSS is welcome; React apps are not in this cut.',
    detail: 'Chargebee hosts it and overlays the workflow. You get mapped steps, brand tokens, and a walkable draft — not an instant publish.',
    icon: uploadUrl,
    iconBox: 'bg-[#f9fafb]',
  },
  {
    id: 'library',
    title: 'Browse templates',
    body: 'Pick a known posture. You will see the step chain, then we gather brand and targeting in Copilot.',
    detail: 'Fair save, click-to-cancel, plan change, and the rest — labelled as the screens a subscriber walks.',
    icon: gridUrl,
    iconBox: 'bg-[#eef2ff]',
  },
  {
    id: 'guide',
    title: 'Where do I start?',
    body: 'Don’t make me think. Copilot asks the job, then recommends a path.',
    detail: 'Short questions, then a recommended chain you can walk as a subscriber.',
    icon: gridUrl,
    iconBox: 'bg-[#eef2ff]',
  },
]

export function BlankJourneyDoors() {
  const chooseDoor = useOrchestration((s) => s.chooseDoor)

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-xl">
      <div className="pointer-events-auto flex w-full max-w-[960px] flex-col items-center">
        <p className="mb-md text-center text-[13px] text-slate-500">
          Start this cancel experience. Copilot takes it from here.
        </p>
        <div className="grid w-full grid-cols-1 gap-md md:grid-cols-3">
          {DOORS.map((door) => (
            <button
              key={door.id}
              type="button"
              onClick={() => chooseDoor(door.id)}
              className="text-left"
            >
              <SCard depth="regular" padding="regular" rounded className="h-full transition-shadow hover:shadow-md">
                <SCard.Content>
                  <span
                    className={`mb-st flex size-9 items-center justify-center rounded-lg ${door.iconBox}`}
                  >
                    <img src={door.icon} alt="" width={18} height={18} className="block size-[18px]" />
                  </span>
                  <p className="text-[15px] font-bold text-slate-900">{door.title}</p>
                  <p className="mt-ti text-[13px] leading-relaxed text-slate-600">{door.body}</p>
                  <p className="mt-st text-[12px] leading-relaxed text-slate-400">{door.detail}</p>
                </SCard.Content>
              </SCard>
            </button>
          ))}
        </div>
        <p className="mt-lg text-center text-[12.5px] text-slate-500">
          Acquiring a subscriber instead?{' '}
          <button
            type="button"
            onClick={() => chooseDoor('acquire')}
            className="font-semibold text-[#4f46e5] underline decoration-solid underline-offset-2"
          >
            Pricing table → hosted checkout
          </button>
        </p>
      </div>
    </div>
  )
}
