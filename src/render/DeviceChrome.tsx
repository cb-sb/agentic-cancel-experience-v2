import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { DeviceKind } from '../store/useExperience'
import { DEVICE_WIDTHS } from './DeviceFrame'

/**
 * Realistic hardware/browser chrome for the subscriber Preview.
 *
 * Each device is a FIXED-SIZE frame whose screen keeps a true-to-life aspect
 * ratio — monitor 16:10, iPad 3:4, phone 19.5:9. The frame is drawn at its
 * native design size, then proportionally scaled (via transform) to fit the
 * available viewport height so the whole preview never scrolls. The cancel
 * modal sits over a faint "page behind" mock + scrim inside a screen that
 * scrolls internally when the content is taller than the device.
 */

// Screen viewport dimensions (device-independent pixels), matched to common
// Chrome DevTools device presets so the preview reads true-to-life:
//   • desktop ~ a small laptop (1024×640, 16:10) rather than an ultrawide
//     monitor, so the preview reads as a normal laptop browser
//   • tablet  ~ iPad Air portrait (820×1180)
//   • mobile  ~ iPhone 12/13/14 (390×844, ~19.5:9)
//
// `contentMax` is the modal card width and is kept in lockstep with the
// composer's DEVICE_WIDTHS (desktop 680 / tablet 560 / mobile 380) so the same
// step reflows to the SAME width — and therefore the same aspect ratio — in
// both the composer canvas and the subscriber preview. The screen is always
// wider than the modal (minus `pad`) so the dialog reads as a centered overlay,
// except on mobile where the modal nearly fills the phone as it would in real life.
const DESKTOP = { width: 1024, screenH: 640, contentMax: DEVICE_WIDTHS.desktop, pad: 40 }
const TABLET = { screenW: 820, screenH: 1180, contentMax: DEVICE_WIDTHS.tablet, pad: 32 }
const MOBILE = { screenW: 390, screenH: 844, contentMax: DEVICE_WIDTHS.mobile, pad: 5 }

const SCREEN_DIMS: Record<DeviceKind, { width: number; height: number; contentMax: number; pad: number }> = {
  desktop: { width: DESKTOP.width, height: DESKTOP.screenH, contentMax: DESKTOP.contentMax, pad: DESKTOP.pad },
  tablet: { width: TABLET.screenW, height: TABLET.screenH, contentMax: TABLET.contentMax, pad: TABLET.pad },
  mobile: { width: MOBILE.screenW, height: MOBILE.screenH, contentMax: MOBILE.contentMax, pad: MOBILE.pad },
}

export function DeviceChrome({
  device,
  brandName,
  fullBleed = false,
  bare = false,
  children,
}: {
  device: DeviceKind
  brandName?: string
  /** Full-page shell: the experience fills the screen (no page-behind + scrim). */
  fullBleed?: boolean
  /** Drop the device hardware bezel — render only the aspect-correct screen. */
  bare?: boolean
  children: ReactNode
}) {
  // Bare: keep the true screen aspect ratio (scaled to fit) but skip the
  // monitor/iPad/phone hardware — used in the composer canvas.
  if (bare) {
    const { width, height, contentMax, pad } = SCREEN_DIMS[device]
    return (
      <FittedDevice>
        <div
          className="flex-none overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/10"
          style={{ width }}
        >
          <ScreenSurface height={height} contentMax={contentMax} pad={pad} fullBleed={fullBleed}>
            {children}
          </ScreenSurface>
        </div>
      </FittedDevice>
    )
  }

  const frame =
    device === 'desktop' ? (
      <DesktopChrome brandName={brandName} fullBleed={fullBleed}>{children}</DesktopChrome>
    ) : device === 'tablet' ? (
      <TabletChrome fullBleed={fullBleed}>{children}</TabletChrome>
    ) : (
      <MobileChrome fullBleed={fullBleed}>{children}</MobileChrome>
    )
  return <FittedDevice>{frame}</FittedDevice>
}

/**
 * Centers a native-size device in the available stage and scales it down
 * proportionally (never up) so it always fits without the page scrolling. The
 * device's layout box stays native — a CSS transform only affects the visual —
 * so the surrounding stage clips the (now smaller) frame and never overflows.
 */
export function FittedDevice({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const deviceRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const compute = () => {
      const stage = stageRef.current
      const dev = deviceRef.current
      if (!stage || !dev) return
      // offsetWidth/Height report the untransformed (native) layout size.
      const natW = dev.offsetWidth
      const natH = dev.offsetHeight
      if (!natW || !natH) return
      const next = Math.min(1, stage.clientHeight / natH, stage.clientWidth / natW)
      setScale((prev) => (Math.abs(prev - next) > 0.002 ? next : prev))
    }
    compute()
    const ro = new ResizeObserver(compute)
    if (stageRef.current) ro.observe(stageRef.current)
    if (deviceRef.current) ro.observe(deviceRef.current)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [])

  // Top-align (not center) so the device hugs the top of the stage — on large
  // viewports the device caps at scale 1 and a centered layout would otherwise
  // leave a big empty band above it, making the card look pushed down.
  return (
    <div ref={stageRef} className="flex h-full w-full items-start justify-center overflow-hidden">
      <div ref={deviceRef} className="flex-none" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {children}
      </div>
    </div>
  )
}

/** A faint account-page mock pinned behind the modal, plus a dim scrim. Stays
 *  fixed to the screen viewport while the modal scrolls over it. */
export function PageBehind() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="p-6 opacity-70">
        <div className="h-5 w-32 rounded bg-slate-300/70" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="h-16 rounded-xl bg-slate-200" />
          <div className="h-16 rounded-xl bg-slate-200" />
          <div className="h-16 rounded-xl bg-slate-200" />
        </div>
        <div className="mt-4 h-28 rounded-xl bg-slate-200/80" />
        <div className="mt-4 h-3 w-2/3 rounded bg-slate-200" />
        <div className="mt-2 h-3 w-1/2 rounded bg-slate-200" />
      </div>
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]" />
    </div>
  )
}

/** Fixed-height screen: backdrop stays put, the modal scrolls inside it. */
function ScreenSurface({
  height,
  contentMax,
  pad = 24,
  fullBleed = false,
  style,
  children,
}: {
  height: number
  contentMax: number
  /** Inner gutter between the modal card and the screen edge (px). */
  pad?: number
  fullBleed?: boolean
  style?: CSSProperties
  children: ReactNode
}) {
  // Full-page shell: the experience IS the page — fill the screen edge-to-edge,
  // no account-page mock or scrim, and let the page manage its own scroll.
  if (fullBleed) {
    return (
      <div className="relative w-full overflow-hidden" style={{ height, ...style }}>
        {children}
      </div>
    )
  }
  return (
    <div className="relative w-full overflow-hidden bg-slate-100" style={{ height, ...style }}>
      <PageBehind />
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="flex min-h-full items-center justify-center" style={{ padding: pad }}>
          <div className="w-full" style={{ maxWidth: contentMax }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrafficDot({ color }: { color: string }) {
  return <span className="h-3 w-3 rounded-full" style={{ background: color }} />
}

function DesktopChrome({ brandName, fullBleed, children }: { brandName?: string; fullBleed?: boolean; children: ReactNode }) {
  const host = `${(brandName ?? 'app').toLowerCase().replace(/\s+/g, '')}.com`
  return (
    <div className="flex flex-none flex-col items-center">
      {/* Monitor bezel */}
      <div className="rounded-[1.4rem] bg-slate-800 p-3.5 shadow-2xl ring-1 ring-black/20">
        <div className="overflow-hidden rounded-lg bg-white" style={{ width: DESKTOP.width }}>
          {/* Browser toolbar */}
          <div className="flex h-11 items-center gap-3 border-b border-slate-200 bg-gradient-to-b from-slate-100 to-slate-50 px-4">
            <div className="flex items-center gap-2">
              <TrafficDot color="#f87171" />
              <TrafficDot color="#fbbf24" />
              <TrafficDot color="#34d399" />
            </div>
            <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-500 shadow-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <span className="truncate">{host}/account/subscription/cancel</span>
            </div>
            <div className="h-4 w-8" />
          </div>
          <ScreenSurface height={DESKTOP.screenH} contentMax={DESKTOP.contentMax} pad={DESKTOP.pad} fullBleed={fullBleed}>
            {children}
          </ScreenSurface>
        </div>
      </div>
      {/* Stand */}
      <div className="h-7 w-28 bg-gradient-to-b from-slate-300 to-slate-400" />
      <div className="h-2.5 w-56 rounded-b-md rounded-t-sm bg-slate-400 shadow-md" />
    </div>
  )
}

function TabletChrome({ fullBleed, children }: { fullBleed?: boolean; children: ReactNode }) {
  return (
    <div className="relative flex-none rounded-[2rem] bg-slate-900 p-4 shadow-2xl ring-1 ring-black/10">
      {/* Front camera */}
      <div className="absolute left-1/2 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-slate-700" />
      <div className="overflow-hidden rounded-[1.3rem]" style={{ width: TABLET.screenW }}>
        <ScreenSurface height={TABLET.screenH} contentMax={TABLET.contentMax} pad={TABLET.pad} fullBleed={fullBleed}>
          {children}
        </ScreenSurface>
      </div>
    </div>
  )
}

function MobileChrome({ fullBleed, children }: { fullBleed?: boolean; children: ReactNode }) {
  return (
    <div className="relative flex-none rounded-[2.75rem] bg-slate-900 p-2.5 shadow-2xl ring-1 ring-black/10">
      {/* Side buttons */}
      <span className="absolute -left-[3px] top-[96px] h-8 w-[3px] rounded-l bg-slate-800" />
      <span className="absolute -left-[3px] top-[136px] h-12 w-[3px] rounded-l bg-slate-800" />
      <span className="absolute -right-[3px] top-[118px] h-16 w-[3px] rounded-r bg-slate-800" />
      <div className="relative overflow-hidden rounded-[2.3rem]" style={{ width: MOBILE.screenW }}>
        {/* Dynamic island (floats above the scrolling content) */}
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-30 h-6 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
        <ScreenSurface height={MOBILE.screenH} contentMax={MOBILE.contentMax} pad={MOBILE.pad} fullBleed={fullBleed}>
          {children}
        </ScreenSurface>
      </div>
    </div>
  )
}
