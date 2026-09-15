export const MEDIA_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime'

const MAX_BYTES = 40 * 1024 * 1024
const SAMPLE = 96

export type MediaKind = 'image' | 'video'

export interface PaletteSwatch {
  hex: string
  count: number
}

export function isMediaFile(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/')
}

export async function samplePaletteFromFile(
  file: File,
): Promise<{ palette: PaletteSwatch[]; kind: MediaKind }> {
  if (file.size > MAX_BYTES) {
    throw new Error('Keep the file under 40 MB — a crop of the billing page is enough.')
  }
  if (file.type.startsWith('video/')) {
    const frames = await videoFrames(file)
    return { palette: mergePalettes(frames.map(histogramFromCanvas)), kind: 'video' }
  }
  if (file.type.startsWith('image/')) {
    const img = await loadImage(file)
    try {
      return { palette: histogramFromCanvas(drawToCanvas(img)), kind: 'image' }
    } finally {
      URL.revokeObjectURL(img.src)
    }
  }
  throw new Error('Drop a screenshot (PNG, JPG, WebP) or a short screen recording (MP4, WebM).')
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That image could not be read.'))
    }
    img.src = url
  })
}

function videoFrames(file: File): Promise<HTMLCanvasElement[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = url

    const frames: HTMLCanvasElement[] = []
    const stamps = [0.2, 0.6]
    let i = 0
    let settled = false

    const finish = (ok: HTMLCanvasElement[] | Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      URL.revokeObjectURL(url)
      if (ok instanceof Error) reject(ok)
      else resolve(ok)
    }

    const timer = window.setTimeout(() => {
      if (frames.length > 0) finish(frames)
      else finish(new Error('Timed out reading that video. Try a screenshot instead.'))
    }, 10_000)

    const grab = () => {
      if (!video.videoWidth) {
        finish(new Error('That video has no picture yet — try a screenshot instead.'))
        return
      }
      frames.push(drawToCanvas(video))
      i += 1
      if (i >= stamps.length) {
        finish(frames)
        return
      }
      seek()
    }

    const seek = () => {
      const d = video.duration
      if (!d || !Number.isFinite(d)) {
        finish(frames.length > 0 ? frames : new Error('That video could not be sampled.'))
        return
      }
      const t = Math.min(d * stamps[i], Math.max(0, d - 0.05))
      if (Math.abs(video.currentTime - t) < 0.02) grab()
      else video.currentTime = t
    }

    video.addEventListener('seeked', grab)
    video.addEventListener('error', () => finish(new Error('That video could not be read.')))
    video.addEventListener('loadeddata', grab)
  })
}

function drawToCanvas(source: CanvasImageSource & { width?: number; height?: number; videoWidth?: number; videoHeight?: number }) {
  const w = ('videoWidth' in source && source.videoWidth) || source.width || 1
  const h = ('videoHeight' in source && source.videoHeight) || source.height || 1
  const scale = Math.min(SAMPLE / w, SAMPLE / h, 1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not sample pixels in this browser.')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

function histogramFromCanvas(canvas: HTMLCanvasElement): PaletteSwatch[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const buckets = new Map<number, number>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 140) continue
    const r = data[i] >> 4
    const g = data[i + 1] >> 4
    const b = data[i + 2] >> 4
    const key = (r << 8) | (g << 4) | b
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.entries()]
    .map(([key, count]) => ({
      hex: expandNibble(key),
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

function expandNibble(key: number): string {
  const r = ((key >> 8) & 15) * 17
  const g = ((key >> 4) & 15) * 17
  const b = (key & 15) * 17
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function toHex(n: number) {
  return n.toString(16).padStart(2, '0')
}

function mergePalettes(lists: PaletteSwatch[][]): PaletteSwatch[] {
  const map = new Map<string, number>()
  for (const list of lists) {
    for (const swatch of list) {
      map.set(swatch.hex, (map.get(swatch.hex) ?? 0) + swatch.count)
    }
  }
  return [...map.entries()]
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count)
}
