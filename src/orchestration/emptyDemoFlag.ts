import { useEffect, useState } from 'react'
import { create } from 'zustand'
import type { JourneyFile } from '../journey/types'
import { useJourney } from '../store/useJourney'

/**
 * Educational empty-state demo. The blank enclosure (Traffic + empty PRIMARY)
 * is still at git tag `empty-canvas-blank` / branch `restore/empty-canvas-blank`
 * (commit 8fbae3b).
 *
 * Restore that UI without git:
 *  - add `?emptyDemo=0` to the URL (persists in localStorage)
 *  - or set EMPTY_JOURNEY_DEMO_DEFAULT to false and reload
 * Re-enable with `?emptyDemo=1`.
 */
export const EMPTY_JOURNEY_DEMO_DEFAULT = true
const STORAGE_KEY = 'cb-empty-journey-demo'

export const DEMO_STAGES: { label: string; caption: string }[] = [
  {
    label: 'What you keep',
    caption: 'They almost left. Show the cost of leaving on this plan — not a guilt trip.',
  },
  {
    label: 'Survey',
    caption: 'Ask why. The answer is for you; it must not block cancel.',
  },
  {
    label: 'Save offer',
    caption: 'One offer after the reason. Discount is the default; swap the mechanic if you already sell pause or a cheaper plan.',
  },
  {
    label: 'Confirm',
    caption: 'Then they must be able to leave. Required — click-to-cancel.',
  },
]

export function isBlankJourney(file: JourneyFile): boolean {
  return file.template === 'none' && file.steps.length === 0
}

export function emptyJourneyDemoEnabled(): boolean {
  if (typeof window === 'undefined') return EMPTY_JOURNEY_DEMO_DEFAULT
  const q = new URLSearchParams(window.location.search).get('emptyDemo')
  if (q === '0' || q === 'false') {
    localStorage.setItem(STORAGE_KEY, '0')
    return false
  }
  if (q === '1' || q === 'true') {
    localStorage.setItem(STORAGE_KEY, '1')
    return true
  }
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === '0') return false
  if (stored === '1') return true
  return EMPTY_JOURNEY_DEMO_DEFAULT
}

/** True when the educational demo should replace the blank enclosure. */
export function useEmptyJourneyDemo(): boolean {
  const file = useJourney((s) => s.file)
  const [flag, setFlag] = useState(EMPTY_JOURNEY_DEMO_DEFAULT)
  useEffect(() => {
    setFlag(emptyJourneyDemoEnabled())
  }, [])
  return flag && isBlankJourney(file)
}

interface EmptyDemoWalk {
  index: number
  setIndex: (index: number) => void
}

export const useEmptyDemoWalk = create<EmptyDemoWalk>((set) => ({
  index: 0,
  setIndex: (index) => set({ index }),
}))
