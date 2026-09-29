import { SIcon } from '@chargebee/sting-react'
import { goBack } from '../shell/navHistory'
import { OTHER_PLAYS } from '../workspace/sampleNonCancel'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { StatusChip } from './StatusChip'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-[16px] border-b border-slate-100 px-[20px] py-[14px] last:border-b-0">
      <span className="w-[120px] flex-none text-[12px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="min-w-0 flex-1 text-[13.5px] text-slate-800">{children}</div>
    </div>
  )
}

/** A play from another objective, summarised the way its play builder reads. */
export function ReadOnlyPlay({ id }: { id: string }) {
  const setReadOnlyId = useWorkspaceUi((s) => s.setReadOnlyId)
  const play = OTHER_PLAYS.find((p) => p.id === id)
  if (!play) return null
  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[760px] px-[32px] py-[32px]">
        <button
          type="button"
          onClick={() => goBack(() => setReadOnlyId(null))}
          className="mb-[20px] flex items-center gap-[6px] text-[13px] font-medium text-slate-500 hover:text-slate-900"
        >
          <SIcon name="arrow-left" size={14} />
          Experiences
        </button>
        <div className="flex items-center gap-[10px]">
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">{play.name}</h1>
          <StatusChip live={play.live} />
        </div>
        <p className="mt-[6px] text-[14px] text-slate-500">{play.description}</p>
        <div className="mt-[24px] overflow-hidden rounded-2xl border border-slate-200">
          <Row label="Play type">{play.playType}</Row>
          <Row label="Audience">{play.audience}</Row>
          <Row label="Trigger">{play.trigger}</Row>
          <Row label="Actions">
            {play.actions.map((a) => (
              <p key={a}>{a}</p>
            ))}
          </Row>
          <Row label="Control">{play.control}</Row>
        </div>
      </div>
    </div>
  )
}
