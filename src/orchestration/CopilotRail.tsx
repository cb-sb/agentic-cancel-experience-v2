import { SIcon } from '@chargebee/sting-react'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { CopilotMark } from './CopilotMark'
import { COPILOT_UI } from './copilotUi'

/** v8: Copilot folded to a strip. Any click on it opens the chat again. */
export function CopilotRail() {
  const expand = () => useWorkspaceUi.getState().setCopilotCollapsed(false)
  return (
    <button
      type="button"
      onClick={expand}
      title="Open Growth Copilot"
      aria-label="Open Growth Copilot"
      className="group flex h-full w-full flex-col items-center gap-[12px] pt-[14px] transition-colors hover:bg-[#f3f4f6]"
      style={{ background: COPILOT_UI.header }}
    >
      <span className="flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-[#677488] group-hover:text-[#183d7a]">
        <SIcon name="panel-right-open" size={16} />
      </span>
      <CopilotMark size={26} />
      <span className="text-[12px] font-semibold text-[#677488] [writing-mode:vertical-rl] group-hover:text-[#183d7a]">Growth Copilot</span>
    </button>
  )
}

/** The header button that folds Copilot away. */
export function CollapseCopilotButton() {
  return (
    <button
      type="button"
      onClick={() => useWorkspaceUi.getState().setCopilotCollapsed(true)}
      title="Collapse Copilot"
      aria-label="Collapse Copilot"
      className="flex h-[32px] w-[32px] flex-none items-center justify-center rounded-[8px] text-[#677488] hover:bg-[#f3f4f6]"
    >
      <SIcon name="panel-right-close" size={16} />
    </button>
  )
}
