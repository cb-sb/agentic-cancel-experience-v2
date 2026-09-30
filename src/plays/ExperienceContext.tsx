import { SIcon } from '@chargebee/sting-react'
import { duplicateThread, useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { copyMarks } from '../setup/useSetupState'
import { openExperience, openPlay } from './navigate'
import { variantShare } from './resolve'
import { variantLetter } from './types'
import { addToPlay, swapExperience, usePlays, usePlaysUsing } from './usePlays'
import { RowMenu, toast } from './ui'

/** Gives this play its own copy of a shared experience, so edits stop reaching the other plays. */
export function separateCopy(experienceId: string, playId: string) {
  const copy = duplicateThread(experienceId)
  if (!copy) return
  copyMarks(experienceId, copy)
  swapExperience(playId, experienceId, copy)
  openExperience(copy, playId)
  useWorkspaceUi.getState().setRenaming(copy)
  const play = usePlays.getState().plays.find((p) => p.id === playId)
  toast(`${play?.name ?? 'This play'} now has its own copy. Give it a name.`)
}

/** v8: under the tabs, which play this experience is being worked on through, and which variant it is there. */
export function ExperienceContextBar() {
  const activeId = useWorkspace((s) => s.activeId)
  const title = useWorkspace((s) => s.threads.find((t) => t.id === s.activeId)?.title ?? '')
  const playId = useWorkspaceUi((s) => s.playId)
  const plays = usePlaysUsing(activeId)
  const all = usePlays((s) => s.plays)
  const current = plays.find((p) => p.id === playId) ?? plays[0]
  const others = plays.filter((p) => p.id !== current?.id)

  if (!current) {
    return (
      <div className="flex h-[36px] flex-none items-center gap-[8px] border-b border-slate-200 bg-white px-[16px] text-[12.5px] text-slate-500">
        <SIcon name="circle-dashed" size={13} className="text-slate-400" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-slate-700">{title}</span> is not in a play yet, so no subscriber sees it.
        </span>
        <RowMenu
          label="Add to a play"
          icon="folder-input"
          width={240}
          items={all.map((p) => ({
            label: p.name,
            icon: 'folder-input',
            onClick: () => {
              addToPlay(p.id, activeId)
              useWorkspaceUi.setState({ playId: p.id })
              toast(`Added to ${p.name}`)
            },
          }))}
        />
        <span className="text-[12px] font-medium text-slate-600">Add to a play</span>
      </div>
    )
  }

  const index = current.variants.findIndex((v) => v.experienceId === activeId)
  const v = current.variants[index]
  return (
    <div className="flex-none border-b border-slate-200 bg-white">
      <div className="flex h-[36px] items-center gap-[8px] px-[16px] text-[12.5px] text-slate-500">
        <button
          type="button"
          onClick={() => openPlay(current.id)}
          className="flex min-w-0 items-center gap-[6px] rounded-md px-[4px] py-[2px] font-medium text-slate-700 hover:bg-slate-100"
          title={`Open ${current.name}`}
        >
          <SIcon name="workflow" size={13} className="flex-none text-slate-400" />
          <span className="truncate">{current.name}</span>
        </button>
        <SIcon name="chevron-right" size={11} className="flex-none text-slate-300" />
        <span className="flex-none rounded-md bg-slate-100 px-[6px] py-[1px] text-[11.5px] font-semibold text-slate-600">
          Variant {variantLetter(index)}
        </span>
        {v && <span className="min-w-0 truncate">{variantShare(current, v)}</span>}
        {others.length > 0 && (
          <span className="ml-auto flex flex-none items-center gap-[4px]">
            Also in
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openExperience(activeId, p.id)}
                className="rounded-md px-[4px] py-[1px] font-medium text-indigo-600 hover:bg-indigo-50"
              >
                {p.name}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}
