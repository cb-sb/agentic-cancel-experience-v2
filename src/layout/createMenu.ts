import type { SIconName } from '@chargebee/sting-react'
import { contextPlayId, createExperience, openLibrary } from '../plays/navigate'
import type { MenuItem } from '../plays/ui'
import type { ShellLayout } from '../types/experience'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'

const SHELL_CHOICES: { id: ShellLayout; label: string; hint: string; icon: SIconName }[] = [
  { id: 'modal', label: 'Modal', hint: 'Opens over your account page', icon: 'layers' },
  { id: 'fullpage', label: 'Full page', hint: 'Full viewport width, one step at a time', icon: 'file-text' },
  { id: 'fullpage_scroll', label: 'Full page continuous', hint: 'Every step on one scrolling page', icon: 'list-ordered' },
]

/** v8: everything a merchant can make for the cancel flow. A new experience joins the play they are in. */
export function createMenuItems(): MenuItem[] {
  return [
    {
      label: 'Cancel experience…',
      icon: 'layers',
      hint: 'Pick a layout first',
      items: SHELL_CHOICES.map((s) => ({
        label: s.label,
        icon: s.icon,
        hint: s.hint,
        onClick: () => {
          const ui = useWorkspaceUi.getState()
          const inPlay = ui.page === 'play' ? ui.playId : ui.page === 'thread' ? contextPlayId() : null
          createExperience({ playId: inPlay, shell: s.id })
        },
      })),
    },
    { label: 'Offer', icon: 'gift', hint: 'Discount, pause, plan change and more', onClick: () => openLibrary('offers', true) },
    { label: 'Survey reason', icon: 'message-square', hint: 'Why they are leaving, linked to an offer', onClick: () => openLibrary('reasons', true) },
    { label: 'Loss aversion card', icon: 'shield', hint: 'What they would lose by leaving', onClick: () => openLibrary('cards', true) },
  ]
}
