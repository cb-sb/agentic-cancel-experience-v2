import { SIcon } from '@chargebee/sting-react'
import { V8 } from '../layout/layoutMode'
import { useOrchestration } from '../store/useOrchestration'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { DEFAULT_ROUTE } from './nav'
import { goBack, useCanGoBack } from './navHistory'
import { useGrowthShell } from './useGrowthShell'

export function backToExperiences() {
  useOrchestration.getState().closeTemplates()
  useWorkspaceUi.getState().setPage('index')
}

export function backToHome() {
  useGrowthShell.getState().go(DEFAULT_ROUTE)
}

/**
 * v8: one back control for every page. Goes to the previous place; on a fresh
 * load it goes to `fallback`, and hides when there is neither.
 */
export function BackButton({
  fallback,
  onBack,
  className = '',
}: {
  fallback?: () => void
  /** Replaces the history step, for pages with their own way back. */
  onBack?: () => void
  className?: string
}) {
  const canGoBack = useCanGoBack()
  if (!V8 || (!canGoBack && !fallback && !onBack)) return null
  return (
    <button
      type="button"
      onClick={onBack ?? (() => goBack(fallback))}
      aria-label="Back"
      title="Back"
      className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      <SIcon name="arrow-left" size={16} />
    </button>
  )
}
