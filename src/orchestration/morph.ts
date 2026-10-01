/**
 * Shared-element morph between the template strip and the full-size screens.
 * Elements opt in with `data-morph-screen={i}`, `data-morph-label={i}` and
 * `data-morph-fade`. Moving parts are animated as copies in a fixed layer, so
 * scroll containers in between can't clip them. Each screen cross-fades: the
 * outgoing version travels with it and fades out while the new one fades in.
 */

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const MS = 460

interface Shot {
  rect: DOMRect
  ghost: HTMLElement
}

export interface MorphSnapshot {
  screens: Shot[]
  labels: DOMRect[]
}

export function morphSnapshot(root: ParentNode | null): MorphSnapshot | null {
  if (!root) return null
  const screens: Shot[] = []
  root.querySelectorAll<HTMLElement>('[data-morph-screen]').forEach((el) => {
    screens[Number(el.dataset.morphScreen)] = { rect: el.getBoundingClientRect(), ghost: el.cloneNode(true) as HTMLElement }
  })
  const labels: DOMRect[] = []
  root.querySelectorAll<HTMLElement>('[data-morph-label]').forEach((el) => {
    labels[Number(el.dataset.morphLabel)] = el.getBoundingClientRect()
  })
  return { screens, labels }
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const TEXT_STYLES = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'whiteSpace'] as const

/** Copies keep only their own classes once moved to the body, so inherited text styles are carried over by hand. */
function textStyles(el: Element): Partial<CSSStyleDeclaration> {
  const cs = getComputedStyle(el)
  return Object.fromEntries(TEXT_STYLES.map((k) => [k, cs[k]]))
}

/** Lays `node` over the page at `at` and plays `frames`; `onDone` runs when it ends, or on a timer if the page isn't painting. */
function fly(node: HTMLElement, at: DOMRect, frames: Keyframe[], onDone?: () => void, text?: Partial<CSSStyleDeclaration>) {
  node.removeAttribute('data-morph-screen')
  node.removeAttribute('data-morph-label')
  Object.assign(node.style, text, {
    position: 'fixed',
    left: `${at.left}px`,
    top: `${at.top}px`,
    width: `${at.width}px`,
    height: `${at.height}px`,
    margin: '0',
    zIndex: '80',
    pointerEvents: 'none',
    transformOrigin: 'top left',
    visibility: 'visible',
  })
  document.body.appendChild(node)
  let timer = 0
  const done = () => {
    window.clearTimeout(timer)
    node.remove()
    onDone?.()
  }
  const anim = node.animate(frames, { duration: MS, easing: EASE })
  anim.onfinish = done
  anim.oncancel = done
  timer = window.setTimeout(done, MS + 250)
}

/** Moves each screen and label in `root` from where it was in `from` to where it is now, and fades in the rest. */
export function playMorph(root: HTMLElement | null, from: MorphSnapshot | null, radius: { from: number; to: number }) {
  if (!root || !from || reducedMotion()) return
  root.querySelectorAll<HTMLElement>('[data-morph-screen]').forEach((el) => {
    const shot = from.screens[Number(el.dataset.morphScreen)]
    const now = el.getBoundingClientRect()
    if (!shot || !now.width || !now.height || el.style.visibility === 'hidden') return
    const old = shot.rect
    const s = old.width / now.width
    const cut = Math.max(0, now.height - old.height / s)
    const back = `translate(${old.left - now.left}px, ${old.top - now.top}px) scale(${s})`

    const ghostCut = Math.max(0, old.height - now.height * s)
    fly(shot.ghost, old, [
      { offset: 0, transform: 'none', clipPath: `inset(0 0 0 0 round ${radius.from}px)`, opacity: 1 },
      { offset: 0.5, opacity: 0 },
      {
        offset: 1,
        transform: `translate(${now.left - old.left}px, ${now.top - old.top}px) scale(${1 / s})`,
        clipPath: `inset(0 0 ${ghostCut}px 0 round ${radius.to * s}px)`,
        opacity: 0,
      },
    ])

    el.style.visibility = 'hidden'
    fly(
      el.cloneNode(true) as HTMLElement,
      now,
      [
        { offset: 0, transform: back, clipPath: `inset(0 0 ${cut}px 0 round ${radius.from / s}px)`, opacity: 0 },
        { offset: 0.45, opacity: 1 },
        { offset: 1, transform: 'none', clipPath: `inset(0 0 0 0 round ${radius.to}px)`, opacity: 1 },
      ],
      () => {
        el.style.visibility = ''
      },
    )
  })
  root.querySelectorAll<HTMLElement>('[data-morph-label]').forEach((el) => {
    const old = from.labels[Number(el.dataset.morphLabel)]
    const now = el.getBoundingClientRect()
    if (!old || !now.width || el.style.visibility === 'hidden') return
    const text = textStyles(el)
    el.style.visibility = 'hidden'
    fly(
      el.cloneNode(true) as HTMLElement,
      now,
      [{ transform: `translate(${old.left - now.left}px, ${old.top - now.top}px)` }, { transform: 'none' }],
      () => {
        el.style.visibility = ''
      },
      text,
    )
  })
  fadeIn(root.querySelectorAll('[data-morph-fade]'), 120)
}

export function fadeIn(els: Iterable<Element>, delay = 0) {
  if (reducedMotion()) return
  for (const el of els) {
    el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], {
      duration: 280,
      delay,
      easing: EASE,
      fill: 'backwards',
    })
  }
}
