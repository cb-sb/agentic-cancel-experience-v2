import { CopilotMark } from '../orchestration/CopilotMark'
import { CollapseCopilotButton } from '../orchestration/CopilotRail'
import { COPILOT_UI } from '../orchestration/copilotUi'

/** Where the Concierge agent will sit beside an experience or play. The chat itself comes in a later pass. */
export function AgentSlot({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div
        className="flex h-[60px] flex-none items-center gap-[10px] px-[16px]"
        style={{ background: COPILOT_UI.header, borderBottom: `1px solid ${COPILOT_UI.hairline}` }}
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-bold leading-tight tracking-tight" style={{ color: COPILOT_UI.title }}>
            Growth Copilot
          </h2>
          {subtitle && (
            <p className="truncate text-[13px] leading-tight" style={{ color: COPILOT_UI.muted }}>
              {subtitle}
            </p>
          )}
        </div>
        <CollapseCopilotButton />
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[10px] px-[32px] text-center">
        <CopilotMark size={32} />
        <p className="text-[14px] font-semibold text-slate-800">The agent chat goes here</p>
        <p className="max-w-[260px] text-[13px] leading-[1.5] text-slate-500">
          You'll be able to ask Copilot to set this up or change it. For now, use the tabs on the left.
        </p>
      </div>
      <div className="flex-none px-[16px] pb-[16px]">
        <div className="flex h-[44px] items-center rounded-[12px] border border-dashed border-slate-300 px-[14px] text-[13px] text-slate-400">
          Ask Copilot
        </div>
      </div>
    </div>
  )
}
