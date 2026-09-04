/**
 * Focus presentation audit.
 *
 * The focused card is the one thing in the product drawn at true 1:1, and the
 * two presentations put it in very different amounts of room. This checks that
 * each holds that promise at the widths merchants actually use, and — for the
 * drawer — that it takes its promised share of the viewport, that the scrim
 * dims the play without ever reaching the editor, and that whatever canvas is
 * left still shows the step being edited.
 *
 * Usage: npm run audit:focus
 */
import { chromium, type Page } from 'playwright'

const URL = process.env.URL ?? 'http://localhost:5174'
const WIDTHS = [1366, 1440, 1920]
/** Mirrors the drawer tokens in src/orchestration/focus/tokens.ts. */
const FRACTION = 0.7
const DRAWER_MIN = 740
const PEEK_MIN = 280

interface Fault {
  width: number
  presentation: string
  check: string
  detail: string
}

async function measure(page: Page, presentation: 'overlay' | 'drawer') {
  return page.evaluate(
    ({ presentation, FRACTION, DRAWER_MIN, PEEK_MIN }) => {
      const faults: { check: string; detail: string }[] = []
      const add = (check: string, detail: string) => faults.push({ check, detail })
      const px = (n: number) => Math.round(n)

      const card = document.querySelector('[data-focus-card]') as HTMLElement | null
      const root = document.querySelector('[data-focus-root]') as HTMLElement | null
      const pane = document.querySelector('[data-canvas-pane]') as HTMLElement | null
      if (!card || !root || !pane) {
        add('mounted', `card=${!!card} root=${!!root} pane=${!!pane}`)
        return { faults, peek: null as number | null, mode: '-' }
      }

      // 1. True 1:1. Any ancestor transform means editable text is being drawn
      //    through a scale, which is the thing focus mode exists to avoid.
      const want = parseFloat(card.dataset.focusCard ?? '')
      const got = card.getBoundingClientRect().width
      if (want && Math.abs(got - want) > 1) add('scale', `${want}px card drawn ${px(got)}px wide`)

      // 2. The card fits its shell. The overlay used to be confined to the canvas
      //    column, so a 680px card bled under both panes at laptop widths and
      //    nobody noticed at 1920.
      const shell = card.closest('[data-focus-shell]') as HTMLElement | null
      if (shell) {
        const c = card.getBoundingClientRect()
        const s = shell.getBoundingClientRect()
        if (c.left < s.left - 1 || c.right > s.right + 1)
          add('clipped', `card ${px(c.left)}-${px(c.right)} vs shell ${px(s.left)}-${px(s.right)}`)
      }

      // 3. Neither presentation may cover the settings pane, which is what the
      //    focused card is edited with.
      const layer = document.querySelector(
        presentation === 'drawer' ? '[data-focus-drawer]' : '[data-focus-overlay]',
      ) as HTMLElement | null
      if (!layer) {
        add('mounted', `no ${presentation} layer`)
        return { faults, peek: null, mode: '-' }
      }
      const l = layer.getBoundingClientRect()
      const p = pane.getBoundingClientRect()
      if (l.right > p.right + 1) add('covers-settings', `layer ends ${px(l.right)}, pane ${px(p.right)}`)

      let peek: number | null = null
      let mode = 'overlay'
      if (presentation === 'drawer') {
        const r = root.getBoundingClientRect()
        // Everything the drawer is allowed to use: root, less the settings pane.
        const room = p.right - r.left
        peek = px(l.left - r.left)
        const full = Math.abs(l.width - room) <= 1
        mode = full ? 'full' : 'drawer'

        // 4. The drawer takes its share of the viewport, clamped by the canvas
        //    it has to leave behind and floored by a 1:1 card.
        const share = Math.round(r.width * FRACTION)
        const want = Math.min(
          Math.round(room),
          Math.max(Math.min(share, Math.round(room) - PEEK_MIN), DRAWER_MIN),
        )
        if (Math.abs(l.width - want) > 2) add('width', `drawer ${px(l.width)}px, expected ${want}px`)

        // 5. Enough canvas left to read the play, unless the 1:1 floor took it.
        if (peek < PEEK_MIN && l.width > DRAWER_MIN + 1)
          add('peek', `only ${peek}px of canvas, floor is ${PEEK_MIN}px`)

        // 6. The scrim covers the play up to the drawer and stops short of the
        //    settings pane, so what it dims is context and never the editor.
        const scrim = document.querySelector('[data-focus-scrim]') as HTMLElement | null
        if (!full) {
          if (!scrim) add('scrim', 'no scrim over the play')
          else {
            const s = scrim.getBoundingClientRect()
            if (Math.abs(s.left - r.left) > 1 || Math.abs(s.right - l.left) > 1)
              add('scrim', `scrim ${px(s.left)}-${px(s.right)}, drawer starts ${px(l.left)}`)
          }
        } else if (scrim) add('scrim', 'scrim rendered with nothing behind it')

        // 7. Whatever canvas is left must show the step being edited, not the
        //    back of the drawer covering its own subject.
        const node = document
          .querySelector('[data-step-focused]')
          ?.closest('.react-flow__node') as HTMLElement | null
        if (!node) add('mounted', 'focused step node not found')
        else if (!full && peek > 320) {
          const n = node.getBoundingClientRect()
          if (n.right > l.left + 1)
            add('covered', `step ends ${px(n.right)}, drawer starts ${px(l.left)}`)
        }
      }

      return { faults, peek, mode }
    },
    { presentation, FRACTION, DRAWER_MIN, PEEK_MIN },
  )
}

const browser = await chromium.launch()
const faults: Fault[] = []
const rows: Record<string, string | number>[] = []

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__canvas))
  // Desktop is the widest card, so it is the only one that can fail to fit.
  await page.evaluate(() => window.__canvas!.setDevice('desktop'))

  for (const presentation of ['overlay', 'drawer'] as const) {
    await page.evaluate((p) => window.__canvas!.setFocusPresentation(p), presentation)
    await page.evaluate(() => window.__canvas!.setAssistantOpen(true))
    await page.evaluate(() => window.__canvas!.focusStep(0))
    await page.waitForTimeout(700)

    const { faults: found, peek, mode } = await measure(page, presentation)
    found.forEach((f) => faults.push({ width, presentation, ...f }))
    rows.push({ width, presentation, mode, peek: peek ?? '-', faults: found.length })

    await page.screenshot({ path: `.audit/focus-${presentation}-${width}.png` })
    await page.evaluate(() => window.__canvas!.focusStep(-1))
    await page.waitForTimeout(200)
  }
  await page.close()
}

console.log('\nFocus audit')
console.table(rows)
if (faults.length) {
  console.log('')
  console.table(faults)
}
console.log(`\n${faults.length} fault(s). Screenshots in .audit/\n`)

await browser.close()
if (faults.length) process.exitCode = 1
