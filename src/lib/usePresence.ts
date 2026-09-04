import { useEffect, useState } from 'react'

/**
 * Keeps something mounted long enough to leave.
 *
 * `alive` covers mounting through leaving; `open` is the state to animate
 * towards. Both are derived from `present` rather than only set in the effect,
 * and that is the whole trick. Mounting has to happen in the same render that
 * `present` turns true, so the closed state gets painted and the transition has
 * a "from" to run against — waiting a render for state to catch up puts the
 * mount and the open in one frame, and the browser skips the animation
 * entirely. Leaving is the mirror: `present` is already gone, so the held flag
 * is what keeps the thing on screen long enough to go.
 */
export function usePresence(present: boolean, outMs: number) {
  const [held, setHeld] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (present) {
      setHeld(true)
      const id = requestAnimationFrame(() => setOpen(true))
      return () => cancelAnimationFrame(id)
    }
    setOpen(false)
    const id = setTimeout(() => setHeld(false), outMs)
    return () => clearTimeout(id)
  }, [present, outMs])

  return { alive: present || held, open: present && open }
}
