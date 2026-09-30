import { SIcon } from '@chargebee/sting-react'
import { chatsFor, useAgentStore, type OwnerKey } from '../agent/useAgentStore'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { timeAgo } from './model'

function IconButton({ label, icon, onClick }: { label: string; icon: 'arrow-left' | 'panel-left' | 'plus'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
    >
      <SIcon name={icon} size={16} />
    </button>
  )
}

/** The open experience's own pane: its name, then every chat about it. */
export function ChatsPane({
  owner,
  title,
  meta,
  onBack,
  backLabel,
}: {
  owner: OwnerKey
  title: string
  meta: string
  onBack: () => void
  backLabel: string
}) {
  const open = useWorkspaceUi((s) => s.sidebarOpen)
  const setOpen = useWorkspaceUi((s) => s.setSidebarOpen)
  const chats = useAgentStore((s) => s.chats)
  const activeId = useAgentStore((s) => s.active[owner])
  const list = chatsFor(chats, owner)
  const newChat = () => useAgentStore.getState().newChat(owner)

  if (!open) {
    return (
      <aside className="flex h-full min-h-0 flex-col items-center gap-[4px] border-r border-slate-200 bg-slate-50 py-[14px]">
        <IconButton label="Open side panel" icon="panel-left" onClick={() => setOpen(true)} />
        <IconButton label={backLabel} icon="arrow-left" onClick={onBack} />
        <IconButton label="New chat" icon="plus" onClick={newChat} />
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className="flex h-[60px] flex-none items-center gap-[2px] border-b border-slate-200 px-[10px]">
        <IconButton label={backLabel} icon="arrow-left" onClick={onBack} />
        <div className="min-w-0 flex-1 px-[2px]">
          <p className="truncate text-[13.5px] font-bold text-slate-900">{title}</p>
          <p className="truncate text-[11.5px] text-slate-500">{meta}</p>
        </div>
        <IconButton label="Close side panel" icon="panel-left" onClick={() => setOpen(false)} />
      </div>
      <div className="flex-none px-[10px] pt-[10px]">
        <button
          type="button"
          onClick={newChat}
          className="flex h-9 w-full items-center gap-[10px] rounded-lg px-[10px] text-left text-[13px] font-medium text-slate-700 hover:bg-slate-200/50 hover:text-slate-900"
        >
          <SIcon name="plus" size={15} className="text-slate-500" />
          New chat
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-[10px] pb-[10px] pt-[10px]">
        <p className="px-[10px] pb-[6px] text-[11px] font-bold uppercase tracking-wide text-slate-400">Chats</p>
        <div className="flex flex-col gap-[1px]">
          {list.map((c) => {
            const selected = c.id === activeId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => useAgentStore.getState().setActive(owner, c.id)}
                aria-current={selected ? 'true' : undefined}
                className={`flex w-full items-center gap-[8px] rounded-lg px-[10px] py-[6px] text-left transition-colors ${
                  selected ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200' : 'hover:bg-slate-200/50'
                }`}
              >
                <span className={`min-w-0 flex-1 truncate text-[12.5px] ${selected ? 'font-medium text-slate-900' : 'text-slate-600'}`}>{c.title}</span>
                <span className="flex-none text-[11px] text-slate-400">{timeAgo(c.updatedAt)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
