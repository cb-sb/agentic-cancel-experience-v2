const EVENT = 'play-reveal'

export interface PlayReveal {
  playId: string
  target: string
}

let timer: number | undefined
let outlined: HTMLElement | null = null

/** Move the open play to the audience or experience under the pointer. */
export function revealPlayTarget(playId: string, target: string) {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => reveal(playId, target), 50)
}

function reveal(playId: string, target: string) {
  const value = `${playId}:${target}`
  const node = [...document.querySelectorAll<HTMLElement>('[data-play-target]')].find((item) => item.dataset.playTarget === value)
  if (node) {
    const scroller = scrollParent(node)
    if (scroller) {
      const nodeBox = node.getBoundingClientRect()
      const box = scroller.getBoundingClientRect()
      const top = scroller.scrollTop + (nodeBox.top - box.top) - (box.height - nodeBox.height) / 2
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    } else node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    mark(node)
    return
  }
  window.dispatchEvent(new CustomEvent<PlayReveal>(EVENT, { detail: { playId, target } }))
}

function scrollParent(node: HTMLElement): HTMLElement | null {
  let current = node.parentElement
  while (current) {
    const overflow = getComputedStyle(current).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && current.scrollHeight > current.clientHeight) return current
    current = current.parentElement
  }
  return null
}

function mark(node: HTMLElement) {
  if (outlined && outlined !== node) {
    outlined.style.outline = ''
    outlined.style.outlineOffset = ''
  }
  outlined = node
  node.style.outline = '2px solid #334155'
  node.style.outlineOffset = '2px'
  window.setTimeout(() => {
    if (outlined !== node) return
    node.style.outline = ''
    node.style.outlineOffset = ''
    outlined = null
  }, 700)
}

export function onPlayReveal(playId: string, handler: (target: string) => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<PlayReveal>).detail
    if (detail?.playId === playId) handler(detail.target)
  }
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
