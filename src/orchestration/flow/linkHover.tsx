import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

/**
 * Which reason's route is being pointed at.
 *
 * A survey's wires all leave the same edge of the same card and cross each
 * other on the way to their offers, so a colour alone only says *that* two
 * reasons go to different places, not which goes where. Pointing at a row lifts
 * its wire out of the bundle and pushes the rest back, which is the one gesture
 * that answers the question for a bundled row too — those carry several reasons
 * on one port, and no amount of labelling can split them.
 *
 * Held as a port id rather than an edge id: a port can own more than one wire
 * when the reasons folded into it route to different offers, and all of them
 * belong to the row being pointed at.
 */
const HotPortContext = createContext<(portId: string | null) => void>(() => {})

export const useSetHotPort = () => useContext(HotPortContext)

export function useHotPort() {
  const [hotPort, setHotPort] = useState<string | null>(null)
  const set = useCallback((id: string | null) => setHotPort(id), [])
  return { hotPort, setHotPort: set }
}

export function HotPortProvider({
  onChange,
  children,
}: {
  onChange: (portId: string | null) => void
  children: ReactNode
}) {
  return <HotPortContext.Provider value={onChange}>{children}</HotPortContext.Provider>
}
