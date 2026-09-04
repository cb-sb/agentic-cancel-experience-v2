/**
 * Every step's toolbar, against everything it could be drawn over.
 *
 * The toolbar floats in screen space above a card, so what it clears is decided
 * by a world gap times the zoom — which means a gap that looks fine at 130% can
 * put the toolbar through the card above at 85%. This sweeps every card at every
 * zoom the toolbar exists at and reports any overlap with another card or with
 * the enclosure title, rather than trusting the one card that was checked by
 * hand.
 */
import { chromium, type Page } from 'playwright'

const URL = process.env.URL ?? 'http://localhost:5174'
/** t3 opens at 214/260 ≈ 0.823; sweep from just inside it to the top. */
const ZOOMS = [0.83, 0.9, 1, 1.15, 1.4, 1.6]

interface Fault {
  zoom: number
  card: string
  hits: string
}

async function cards(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-audit-kind="step"]')]
      .map((el) => ({
        label: (el as HTMLElement).innerText.split('\n')[1] ?? '?',
        x: el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2,
        y: el.getBoundingClientRect().top + 24,
      }))
      .sort((a, b) => a.x - b.x || a.y - b.y),
  )
}

/** The toolbar's box against every card that is not the one it belongs to. */
async function overlaps(page: Page, label: string) {
  return page.evaluate((label) => {
    const bar = document.querySelector('[data-screen-px]')?.parentElement
    if (!bar) return { mounted: false, hits: [] as string[] }
    const b = bar.getBoundingClientRect()

    // Everything in the same screen space the toolbar could be drawn over: the
    // other cards, and the title pill hanging off the enclosure's top edge.
    const others = [
      ...[...document.querySelectorAll('[data-audit-kind="step"]')].map((el) => ({
        name: `card:${(el as HTMLElement).innerText.split('\n')[1] ?? '?'}`,
        r: el.getBoundingClientRect(),
      })),
      ...[...document.querySelectorAll('[data-enclosure-title]')].map((el) => ({
        name: 'enclosure title',
        r: el.getBoundingClientRect(),
      })),
    ]

    const hits = others
      .filter(
        (o) =>
          o.name !== `card:${label}` &&
          b.left < o.r.right &&
          b.right > o.r.left &&
          b.top < o.r.bottom &&
          b.bottom > o.r.top,
      )
      .map((o) => o.name)

    return { mounted: true, hits }
  }, label)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => Boolean(window.__canvas))
await page.evaluate(() => window.__canvas!.setAssistantOpen(false))

const faults: Fault[] = []
const rows: Record<string, string | number>[] = []

for (const zoom of ZOOMS) {
  await page.evaluate((z) => window.__canvas!.setZoom(z), zoom)
  await page.waitForTimeout(250)

  let checked = 0
  let missing = 0
  for (const card of await cards(page)) {
    // Cards can sit off-viewport at high zoom; the toolbar geometry does not
    // depend on where the pan happens to be, so those are simply skipped.
    if (card.x < 0 || card.x > 1600 || card.y < 60 || card.y > 940) continue
    await page.mouse.move(card.x, card.y)
    await page.waitForTimeout(140)
    const { mounted, hits } = await overlaps(page, card.label)
    if (!mounted) {
      missing += 1
      continue
    }
    checked += 1
    if (hits.length) faults.push({ zoom, card: card.label, hits: hits.join(', ') })
  }
  rows.push({ zoom, checked, 'no toolbar': missing, faults: faults.filter((f) => f.zoom === zoom).length })
  await page.screenshot({ path: `.audit/toolbar-${zoom}.png` })
}

console.log('\nStep toolbar clearance')
console.table(rows)
if (faults.length) {
  console.log('')
  console.table(faults)
}
console.log(`\n${faults.length} clash(es). Screenshots in .audit/\n`)

await browser.close()
if (faults.length) process.exitCode = 1
