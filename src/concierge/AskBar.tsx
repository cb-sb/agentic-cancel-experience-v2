import { useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { sendAs } from '../agent/chats'
import { useAgentStore } from '../agent/useAgentStore'
import { useGrowthShell } from '../shell/useGrowthShell'

/** A one-line ask on list pages. It opens a new chat on Home with the question. */
export function AskBar({ placeholder }: { placeholder: string }) {
  const [text, setText] = useState('')
  const submit = () => {
    const t = text.trim()
    if (!t) return
    const id = useAgentStore.getState().newChat('home')
    useGrowthShell.getState().go('home')
    sendAs(id, t)
    setText('')
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex items-center gap-[8px] rounded-[12px] border border-slate-200 bg-slate-50/60 px-[12px] py-[7px] focus-within:border-slate-300 focus-within:bg-white"
    >
      <SIcon name="sparkles" size={14} className="flex-none text-slate-400" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
      />
      {text.trim() && (
        <button type="submit" className="flex-none text-[12.5px] font-medium text-slate-700 hover:text-slate-900">
          Ask
        </button>
      )}
    </form>
  )
}
