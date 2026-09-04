/**
 * Canvas invariant audit.
 *
 * The canvas is a scaled surface, so a change that looks right at one zoom can
 * clip, overflow or drift at another — which is how a fix for one tier keeps
 * turning into a bug in the next. This drives the real app across the zoom range
 * and asserts the invariants that make the layout contract hold, then writes a
 * screenshot per step so the ladder can be eyeballed in one place.
 *
 *   npm run audit:canvas
 *   AUDIT_URL=http://localhost:5175 npm run audit:canvas
 *
 * Exits non-zero on any violation, so it can gate a commit.
 */
import { chromium, type Page } from 'playwright'
import { mkdir, rm, writeFile } from 'node:fs/promises'

const BASE_URL = process.env.AUDIT_URL ?? 'http://localhost:5174'
const OUT_DIR = process.env.AUDIT_OUT ?? '.audit'
const VIEWPORT = { width: 1600, height: 950 }

/** World-space slack, in px, before a reserve/render gap counts as a fault. */
const RESERVE_TOL = 1.5
/** Screen-space slack for chrome that claims a constant on-screen size. */
const CHROME_TOL = 2

const ZOOMS = [0.2, 0.28, 0.36, 0.45, 0.55, 0.65, 0.75, 0.85, 1, 1.15, 1.35, 1.6]

interface Violation {
  check: string
  where: string
  detail: string
}

interface Probe {
  zoom: number
  nodes: number
  violations: Violation[]
}

/**
 * Runs inside the page. Everything it needs has to be self-contained: it is
 * serialised across the CDP boundary, so no imports and no closure over Node.
 */
function collect(tolerances: { reserve: number; chrome: number }): Probe {
  const violations: Violation[] = []
  const add = (check: string, where: string, detail: string) =>
    violations.push({ check, where, detail })

  const zoom = window.__canvas?.zoom() ?? 1
  const visible = (el: Element) => (el as HTMLElement).offsetParent !== null
  const nodeEls = [...document.querySelectorAll<HTMLElement>('.react-flow__node')].filter(visible)

  const round = (n: number) => Math.round(n * 10) / 10

  // 1. Reserve >= render. A node's declared box is what the layout reserved for
  //    it; anything drawn past that edge is content the layout did not know
  //    about. Chrome is exempt: it is allowed to hang outside the box by design.
  for (const el of nodeEls) {
    const id = el.dataset.id ?? '?'
    const box = el.getBoundingClientRect()
    const declaredW = parseFloat(el.style.width) || box.width / zoom
    const declaredH = parseFloat(el.style.height) || box.height / zoom
    if (!declaredW || !declaredH) continue

    let right = 0
    let bottom = 0
    for (const d of el.querySelectorAll<HTMLElement>('*')) {
      // Handles are anchors, not content: React Flow deliberately straddles them
      // over the node's edge so a wire meets it cleanly.
      if (d.closest('[data-chrome]') || d.closest('.react-flow__handle')) continue
      const r = d.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      right = Math.max(right, r.right - box.left)
      bottom = Math.max(bottom, r.bottom - box.top)
    }
    const renderedW = right / zoom
    const renderedH = bottom / zoom
    if (renderedH > declaredH + tolerances.reserve) {
      add('reserve-h', id, `reserved ${round(declaredH)} but drew ${round(renderedH)}`)
    }
    if (renderedW > declaredW + tolerances.reserve) {
      add('reserve-w', id, `reserved ${round(declaredW)} but drew ${round(renderedW)}`)
    }
  }

  // 2. Nothing is clipped unless it opted in. `truncate` and `line-clamp` are
  //    deliberate; an overflowing box with neither is content being cut off.
  for (const el of document.querySelectorAll<HTMLElement>('.react-flow__node *')) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    const hidesX = cs.overflowX === 'hidden' || cs.overflowX === 'clip'
    const hidesY = cs.overflowY === 'hidden' || cs.overflowY === 'clip'
    if (!hidesX && !hidesY) continue
    const optedIn =
      cs.textOverflow === 'ellipsis' ||
      cs.webkitLineClamp !== 'none' ||
      el.closest('[data-clip-ok]') !== null
    if (optedIn) continue
    const node = el.closest<HTMLElement>('.react-flow__node')?.dataset.id ?? '?'
    if (hidesX && el.scrollWidth > el.clientWidth + 1) {
      add('clip-x', node, `${el.scrollWidth - el.clientWidth}px cut off horizontally`)
    }
    if (hidesY && el.scrollHeight > el.clientHeight + 1) {
      add('clip-y', node, `${el.scrollHeight - el.clientHeight}px cut off vertically`)
    }
  }

  // 3. Chrome that declares a screen size keeps it at every zoom.
  for (const el of document.querySelectorAll<HTMLElement>('[data-screen-px]')) {
    if (!visible(el)) continue
    const want = parseFloat(el.dataset.screenPx ?? '')
    if (!want) continue
    const got = el.getBoundingClientRect().height
    if (Math.abs(got - want) > tolerances.chrome) {
      add('chrome-size', el.dataset.screenPx ?? '?', `wanted ${want}px on screen, got ${round(got)}`)
    }
  }

  // 4. Every reason-to-offer link the model holds ends up on screen.
  //    Dropping one silently is the failure mode this exists to catch. Bundled
  //    ports mean the count of *wires* can legitimately be lower than the count
  //    of reasons, so the assertion is on reasons accounted for, not on wires:
  //    a wire with an "N reasons" label speaks for N of them.
  const expected = window.__canvas?.mappingExpected() ?? 0
  if (expected > 0) {
    let accounted = 0
    for (const edge of document.querySelectorAll<SVGGElement>('.react-flow__edge.mapping-link')) {
      const label = edge.querySelector('.react-flow__edge-text')?.textContent ?? ''
      const n = /^(\d+) reasons?$/.exec(label.trim())
      accounted += n ? Number(n[1]) : 1
    }
    if (accounted < expected) {
      add('mapping', 'links', `${expected} reasons linked to an offer, ${accounted} accounted for`)
    }
  }

  // 5. The focused card renders at 1:1. Its width on screen has to equal the
  //    device width it was authored at — if any ancestor is scaled, editable
  //    text is being drawn through a transform, which is what focus mode exists
  //    to avoid. Zoom is irrelevant here, and that is the assertion.
  for (const el of document.querySelectorAll<HTMLElement>('[data-focus-card]')) {
    const want = parseFloat(el.dataset.focusCard ?? '')
    const got = el.getBoundingClientRect().width
    if (want && Math.abs(got - want) > 1) {
      add('focus-scale', `${want}px card`, `drawn ${round(got)}px wide at zoom ${round(zoom)}`)
    }
  }

  // 6. Step boxes never overlap. Two cards sharing pixels is the layout losing
  //    track of what it reserved.
  const steps = nodeEls.filter((el) => el.classList.contains('react-flow__node-step'))
  for (let i = 0; i < steps.length; i++) {
    for (let j = i + 1; j < steps.length; j++) {
      const a = steps[i].getBoundingClientRect()
      const b = steps[j].getBoundingClientRect()
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (overlapX > 1 && overlapY > 1) {
        add(
          'overlap',
          `${steps[i].dataset.id} / ${steps[j].dataset.id}`,
          `${round(overlapX)}x${round(overlapY)}px of shared space`,
        )
      }
    }
  }

  return { zoom, nodes: nodeEls.length, violations }
}

async function settle(page: Page) {
  await page.waitForTimeout(160)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

async function probeAt(page: Page, label: string, zoom: number): Promise<Probe & { label: string }> {
  await page.evaluate((z) => window.__canvas?.setZoom(z), zoom)
  await settle(page)
  const probe = await page.evaluate(collect, { reserve: RESERVE_TOL, chrome: CHROME_TOL })
  await page.screenshot({ path: `${OUT_DIR}/${label}.png` })
  return { ...probe, label }
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('.react-flow__node', { timeout: 15_000 })
  await page.waitForFunction(() => Boolean(window.__canvas), null, { timeout: 15_000 })
  await settle(page)

  const results: (Probe & { label: string })[] = []

  for (const zoom of ZOOMS) {
    results.push(await probeAt(page, `zoom-${String(zoom).replace('.', '_')}`, zoom))
  }

  // Collapsed enclosure and focus mode are separate layout paths, so they get
  // their own sweep rather than riding on whatever state the last one left.
  await page.evaluate(() => window.__canvas?.toggleCollapse())
  for (const zoom of [0.36, 0.75, 1.15]) {
    results.push(await probeAt(page, `collapsed-${String(zoom).replace('.', '_')}`, zoom))
  }
  await page.evaluate(() => window.__canvas?.toggleCollapse())

  await page.evaluate(() => window.__canvas?.focusStep(0))
  await settle(page)
  for (const zoom of [0.55, 1]) {
    results.push(await probeAt(page, `focus-${String(zoom).replace('.', '_')}`, zoom))
  }
  await page.evaluate(() => window.__canvas?.focusStep(-1))

  await browser.close()

  const rows = results.map((r) => ({
    state: r.label,
    zoom: r.zoom.toFixed(2),
    nodes: r.nodes,
    faults: r.violations.length,
  }))

  const byCheck = new Map<string, Violation[]>()
  for (const r of results) {
    for (const v of r.violations) {
      const key = `${v.check}`
      if (!byCheck.has(key)) byCheck.set(key, [])
      byCheck.get(key)!.push({ ...v, where: `${r.label} · ${v.where}` })
    }
  }

  console.log('\nCanvas audit')
  console.table(rows)

  const total = results.reduce((n, r) => n + r.violations.length, 0)
  if (byCheck.size) {
    console.log('Faults by check:')
    for (const [check, list] of byCheck) {
      console.log(`\n  ${check} (${list.length})`)
      for (const v of list.slice(0, 8)) console.log(`    ${v.where}: ${v.detail}`)
      if (list.length > 8) console.log(`    …and ${list.length - 8} more`)
    }
  }
  if (pageErrors.length) {
    console.log('\nPage errors:')
    for (const e of [...new Set(pageErrors)]) console.log(`  ${e}`)
  }

  await writeFile(`${OUT_DIR}/report.json`, JSON.stringify({ rows, results, pageErrors }, null, 2))
  console.log(`\n${total} fault(s). Screenshots and report in ${OUT_DIR}/`)

  if (total > 0 || pageErrors.length > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
