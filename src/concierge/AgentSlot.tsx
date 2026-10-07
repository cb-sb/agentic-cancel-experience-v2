import { SIcon } from '@chargebee/sting-react'
import { CopilotDisclaimer, CopilotEmpty, CopilotHeader, CopilotHeaderButton } from '../orchestration/CopilotChrome'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'

/** Where the Concierge agent will sit beside an experience or play, in v9's Copilot chrome. The chat itself comes in a later pass. */
export function AgentSlot({ subtitle }: { subtitle?: string }) {
  const wide = useWorkspaceUi((s) => s.copilotWide)
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[var(--slg-color-bg-surface)]">
      <CopilotHeader>
        <CopilotHeaderButton
          label={wide ? 'Make Copilot narrower' : 'Make Copilot wider'}
          icon={wide ? 'minimize-2' : 'maximize-2'}
          onClick={() => useWorkspaceUi.setState({ copilotWide: !wide })}
        />
        <CopilotHeaderButton label="Close Copilot" icon="x" onClick={() => useWorkspaceUi.getState().setCopilotCollapsed(true)} />
      </CopilotHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-[16px]">
        <CopilotEmpty
          title={subtitle ? `Ask about ${subtitle}` : 'The agent chat goes here'}
          text="You'll be able to ask Copilot to set this up or change it. For now, use the tabs on the left."
        />
      </div>
      <div className="flex-none px-[16px] pb-[16px]">
        <div className="border border-[var(--slg-neutral-300,#c4cad3)] bg-[var(--slg-color-bg-surface)]">
          <p className="min-h-[40px] px-[12px] pt-[12px] text-[13px] leading-[20px] text-[var(--slg-color-text-muted)]">Ask Copilot</p>
          <div className="flex items-center justify-between px-[8px] pb-[8px] pt-[4px] text-[var(--slg-neutral-700)]">
            <span aria-hidden className="flex h-[28px] w-[28px] items-center justify-center">
              <SIcon name="paperclip" size={16} />
            </span>
            <span aria-hidden className="flex h-[28px] w-[32px] items-center justify-center bg-[var(--slg-blue-50)] text-[var(--slg-blue-700)] opacity-70">
              <SIcon name="send" size={15} />
            </span>
          </div>
        </div>
        <CopilotDisclaimer />
      </div>
    </div>
  )
}
