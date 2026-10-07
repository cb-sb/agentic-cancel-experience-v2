import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReactFlow } from '@xyflow/react'

/** Keep in step with the `duration-300` on the drawer below. */
const SLIDE_MS = 300
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]'

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A 340px side drawer that slides in beside the canvas, and stays mounted until it has slid away. */
export function SlideDrawer({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const t = window.setTimeout(() => setMounted(false), reducedMotion() ? 0 : SLIDE_MS)
    return () => window.clearTimeout(t)
  }, [open])

  if (!open && !mounted) return null
  return (
    <div
      className={`h-full flex-none overflow-hidden transition-[width] duration-300 motion-reduce:transition-none ${EASE} ${
        open ? 'w-[340px] starting:w-0' : 'w-0'
      }`}
    >
      <div
        className={`h-full w-[340px] transition-[opacity,translate] duration-300 motion-reduce:transition-none ${EASE} ${
          open ? 'translate-x-0 opacity-100 starting:translate-x-[32px] starting:opacity-0' : 'translate-x-[32px] opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

/** Inside a ReactFlow: glide the graph to fit again once the space around it has changed. */
export function RefitOn({ value }: { value: unknown }) {
  const { fitView } = useReactFlow()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const still = reducedMotion()
    const t = window.setTimeout(() => fitView({ padding: 0.15, maxZoom: 1, duration: still ? 0 : 420 }), still ? 0 : SLIDE_MS)
    return () => window.clearTimeout(t)
  }, [value, fitView])
  return null
}

/** The Test button fades and slides aside while its drawer is open, and comes back when it closes. */
export function testButtonClass(hidden: boolean): string {
  return `w-auto transition-[opacity,translate,scale,visibility] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none ${
    hidden ? 'pointer-events-none invisible translate-x-[12px] opacity-0' : 'pointer-events-auto visible opacity-100'
  }`
}
