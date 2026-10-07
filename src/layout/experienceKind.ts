import type { SIconName } from '@chargebee/sting-react'
import type { ShellLayout } from '../types/experience'
import { fileOfThread, type ExperienceThread } from '../workspace/useWorkspace'

export const SHELL_KIND: Record<ShellLayout, { label: string; plural: string; icon: SIconName }> = {
  modal: { label: 'Modal', plural: 'Modal experiences', icon: 'layers' },
  fullpage: { label: 'Full page', plural: 'Full-page experiences', icon: 'file-text' },
  fullpage_scroll: { label: 'Full page, continuous', plural: 'Continuous experiences', icon: 'scroll-text' },
}

export function shellOf(t: ExperienceThread): ShellLayout {
  return fileOfThread(t).shell ?? 'modal'
}

export function stepCount(t: ExperienceThread): number {
  return fileOfThread(t).steps.length
}
