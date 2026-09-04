/**
 * Renders the same two cards at every tier, side by side, so the fidelity ladder
 * can be judged as a ladder rather than one zoom at a time.
 *
 *   npm run audit:tiers
 */
import { chromium } from 'playwright'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const BASE_URL = process.env.AUDIT_URL ?? 'http://localhost:5174'
const OUT_DIR = process.env.AUDIT_OUT ?? '.audit'

/** One zoom per tier, taken from the middle of each band. */
const SHOTS = [
  { tier: 't0', label: 'T0 · Map', zoom: 0.32 },
  { tier: 't1', label: 'T1 · Outline', zoom: 0.52 },
  { tier: 't2', label: 'T2 · Summary', zoom: 0.72 },
  { tier: 't3', label: 'T3 · Detail', zoom: 1.1 },
]

/** Cards worth comparing: one with ports, one with copy. */
const CARDS = [
  { key: 'survey', match: 'Survey' },
  { key: 'offer', match: 'Discount' },
]

async function main() {
  await rm(`${OUT_DIR}/tiers`, { recursive: true, force: true })
  await mkdir(`${OUT_DIR}/tiers`, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 2 })
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__canvas), null, { timeout: 15_000 })
  await page.waitForTimeout(400)

  const cells: { file: string; label: string }[][] = CARDS.map(() => [])

  for (const shot of SHOTS) {
    await page.evaluate((z) => window.__canvas?.setZoom(z), shot.zoom)
    await page.waitForTimeout(220)

    for (const [row, card] of CARDS.entries()) {
      // Step nodes are ordered as the flow reads, so index picks them out
      // reliably whatever the tier is drawing inside them.
      const index = row === 0 ? 0 : 1
      // React Flow tags each wrapper with its node type.
      const box = await page.locator('.react-flow__node-step').nth(index).boundingBox()
      if (!box) continue
      const pad = 14
      const file = `${OUT_DIR}/tiers/${card.key}-${shot.tier}.png`
      await page.screenshot({
        path: file,
        clip: {
          x: Math.max(0, box.x - pad),
          y: Math.max(0, box.y - pad),
          width: box.width + pad * 2,
          height: box.height + pad * 2,
        },
      })
      cells[row].push({ file: resolve(file), label: shot.label })
    }
  }

  // Compose by laying the crops out in a page and shooting that: keeps the
  // pixels untouched and needs no image library.
  const html = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#f1f5f9;font:500 13px ui-sans-serif,system-ui;padding:28px">
  <div style="font:700 16px ui-sans-serif;color:#0f172a;margin-bottom:4px">Step card fidelity ladder</div>
  <div style="color:#64748b;margin-bottom:20px">Same node, same world size (260 x 168), four tiers. Tier is chosen from on-screen width.</div>
  ${cells
    .map(
      (row) => `<div style="display:flex;gap:20px;align-items:flex-end;margin-bottom:22px">
      ${row
        .map(
          (c) => `<div>
          <div style="color:#475569;margin-bottom:6px">${c.label}</div>
          <img src="file://${c.file}" style="display:block;box-shadow:0 1px 6px rgba(15,23,42,.12);border-radius:6px">
        </div>`,
        )
        .join('')}
    </div>`,
    )
    .join('')}
</body>`

  const composePath = `${OUT_DIR}/tiers/index.html`
  await writeFile(composePath, html)
  await page.goto(`file://${resolve(composePath)}`)
  await page.waitForTimeout(300)
  const strip = `${OUT_DIR}/tier-ladder.png`
  await page.screenshot({ path: strip, fullPage: true })
  await browser.close()

  console.log(`Wrote ${strip}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
