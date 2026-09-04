import { useRef, useState } from 'react'
import type { MediaAsset } from '../../types/experience'
import { useRenderCtx } from '../RenderContext'

function PhotoGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}

function VideoGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#334155">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function objectPosition(media: MediaAsset): string {
  const x = media.focalX ?? 50
  const y = media.focalY ?? 50
  return `${x}% ${y}%`
}

const ASPECT_RATIO = {
  landscape: '16 / 10',
  portrait: '4 / 5',
} as const

const IMAGE_HINT = {
  landscape: 'Max 5 MB · PNG or JPG · 1280 × 800px recommended',
  portrait: 'Max 5 MB · PNG or JPG · 800 × 1280px recommended',
} as const

const VIDEO_HINT = {
  landscape: 'Max 30 MB · MP4 or WebM · 16:10 aspect',
  portrait: 'Max 30 MB · MP4 or WebM · 4:5 aspect',
} as const

/** Media block baked into a template card. When the merchant uploads a photo or
 * video it renders the real asset; otherwise it shows a typed placeholder. In
 * Compose the merchant can upload/replace/remove the asset. */
export function MediaBlock({
  media,
  onChange,
  fill = false,
  aspect = 'landscape',
}: {
  media: MediaAsset
  onChange: (patch: Partial<MediaAsset>) => void
  /** Fill the parent's height (match a neighbouring text column) instead of a
   *  fixed aspect ratio. */
  fill?: boolean
  aspect?: 'landscape' | 'portrait'
}) {
  const { mode } = useRenderCtx()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isVideo = media.type === 'video'
  const hasAsset = !!media.url
  const compose = mode === 'compose'
  const pos = objectPosition(media)

  const readFile = (file: File) => {
    const type: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image'
    const reader = new FileReader()
    reader.onload = () => onChange({ url: String(reader.result), type, focalX: 50, focalY: 50 })
    reader.readAsDataURL(file)
  }

  const startDrag = (clientX: number, clientY: number) => {
    const frame = frameRef.current
    if (!frame || !hasAsset || isVideo || !compose) return
    setIsDragging(true)

    const move = (x: number, y: number) => {
      const rect = frame.getBoundingClientRect()
      const focalX = Math.round(Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100)))
      const focalY = Math.round(Math.max(0, Math.min(100, ((y - rect.top) / rect.height) * 100)))
      onChange({ focalX, focalY })
    }

    move(clientX, clientY)

    const onMove = (e: PointerEvent) => move(e.clientX, e.clientY)
    const onUp = () => {
      setIsDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={frameRef}
      className={`relative flex items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${
        fill ? 'h-full min-h-0' : ''
      }`}
      style={{
        aspectRatio: fill ? undefined : ASPECT_RATIO[aspect],
        borderColor: hasAsset ? 'transparent' : '#cbd5e1',
        background: hasAsset ? '#0f172a' : '#f8fafc',
      }}
    >
      {hasAsset ? (
        isVideo ? (
          <video
            src={media.url}
            className="h-full w-full object-cover"
            style={{ objectPosition: pos }}
            muted
            loop
            playsInline
            controls={!compose}
            autoPlay={!compose}
          />
        ) : (
          <img
            src={media.url}
            alt=""
            className="h-full w-full object-cover select-none"
            style={{
              objectPosition: pos,
              cursor: compose ? (isDragging ? 'grabbing' : 'grab') : undefined,
            }}
            draggable={false}
            onPointerDown={
              compose
                ? (e) => {
                    if ((e.target as HTMLElement).closest('button')) return
                    e.preventDefault()
                    startDrag(e.clientX, e.clientY)
                  }
                : undefined
            }
          />
        )
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
            {isVideo ? <VideoGlyph /> : <PhotoGlyph />}
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            {isVideo ? 'Upload a video' : 'Upload a photo'}
          </span>
          <span className="max-w-[180px] text-[10px] leading-snug text-slate-400">
            {isVideo ? VIDEO_HINT[aspect] : IMAGE_HINT[aspect]}
          </span>
        </div>
      )}

      {compose && hasAsset && !isVideo && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm">
          Drag to reposition
        </div>
      )}

      {compose && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) readFile(file)
              e.target.value = ''
            }}
          />
          <div className="absolute right-2 top-2 flex items-center gap-1">
            {/* Type switch only matters before an asset is chosen. */}
            {!hasAsset && (
              <div className="flex items-center rounded-full bg-white/85 p-0.5 text-[10px] font-semibold shadow-sm backdrop-blur">
                {(['image', 'video'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange({ type: t })}
                    className={`rounded-full px-2 py-0.5 transition-colors ${
                      (t === 'video') === isVideo ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t === 'image' ? 'Photo' : 'Video'}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
            >
              {hasAsset ? 'Replace' : 'Upload'}
            </button>
            {hasAsset && (
              <button
                type="button"
                onClick={() => onChange({ url: undefined })}
                className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm backdrop-blur transition-colors hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
