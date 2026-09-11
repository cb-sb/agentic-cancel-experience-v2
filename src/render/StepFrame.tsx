import type { ReactNode } from 'react'
import type { Branding, FrameVisibility } from '../types/experience'
import { BrandLogo } from './BrandUI'
import { EditableText } from './Editable'
import { useRenderCtx } from './RenderContext'

interface StepFrameProps {
  index: number
  total: number
  title: string
  description: string
  frame: FrameVisibility
  branding: Branding
  showBack: boolean
  onBack?: () => void
  onExit?: () => void
  /** Right-aligned primary actions (Continue, or Keep/Cancel on confirmation). */
  actions: ReactNode
  /** Confirmation renders its own centered content, so we drop the title block. */
  hideTitleBlock?: boolean
  /** Center the action CTAs in the nav bar (used on the confirmation step). */
  centerActions?: boolean
  /** Modal only: pin the card to this height so it never jumps between steps. */
  fixedHeight?: number
  /** Optional guardrails for the step title (H2). */
  titleMaxWords?: number
  titleMaxChars?: number
  descriptionMaxChars?: number
  children: ReactNode
}

export function StepFrame(props: StepFrameProps) {
  const { shell } = useRenderCtx()
  return shell === 'modal' ? <ModalFrame {...props} /> : <FullPageFrame {...props} />
}

/** Shared header controls (logo, progress, exit) reused by both shells. */
function useHeaderBits({
  frame,
  branding,
  index,
  total,
  onExit,
}: Pick<StepFrameProps, 'frame' | 'branding' | 'index' | 'total' | 'onExit'>) {
  const logo = frame.logo ? <BrandLogo branding={branding} /> : <span />
  const meta = (
    <div className="flex items-center gap-4">
      {frame.progress && (
        <span className="text-[11px] font-semibold tracking-wider text-slate-400">
          STEP {index + 1} OF {total}
        </span>
      )}
      {frame.exitX && (
        <button
          type="button"
          aria-label="Exit"
          onClick={onExit}
          className="text-slate-400 transition-colors hover:text-slate-600"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
  return { logo, meta }
}

/**
 * Modal header bar — logo on the left, progress/exit on the right. Its fill is
 * driven by `--brand-header` (transparent by default, so it reads as the card
 * fill) and is editable independently under Branding → Colors.
 */
function ModalHeader({ logo, meta }: { logo: ReactNode; meta: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between border-b border-black/5 px-8 py-5"
      style={{ background: 'var(--brand-header, transparent)' }}
    >
      {logo}
      {meta}
    </div>
  )
}

/** Shared editable title block. Larger, left-aligned on the hosted full page. */
function TitleBlock({
  title,
  description,
  frame,
  titleMaxWords,
  titleMaxChars,
  descriptionMaxChars,
}: Pick<
  StepFrameProps,
  'title' | 'description' | 'frame' | 'titleMaxWords' | 'titleMaxChars' | 'descriptionMaxChars'
>) {
  const { edit, shell } = useRenderCtx()
  if (!(frame.title || frame.description)) return null
  const fullPage = shell !== 'modal'
  return (
    <div className={fullPage ? 'mb-4 max-w-xl' : 'mb-6'}>
      {frame.title && (
        <EditableText
          as="h2"
          value={title}
          onCommit={(v) => edit?.updateStep({ title: v })}
          placeholder="Add a headline…"
          singleLine
          maxWords={titleMaxWords}
          maxChars={titleMaxChars}
          className={
            fullPage
              ? 'text-[30px] font-extrabold leading-[1.14] tracking-tight'
              : 'text-[22px] font-bold leading-tight'
          }
          style={{ fontFamily: 'var(--brand-font-heading)', color: 'var(--brand-title)' }}
        />
      )}
      {frame.description && (
        <EditableText
          as="p"
          value={description}
          onCommit={(v) => edit?.updateStep({ description: v })}
          placeholder="Add a short description…"
          maxChars={descriptionMaxChars}
          className={
            fullPage
              ? 'mt-2.5 text-[15px] leading-relaxed text-slate-500'
              : 'mt-1.5 text-sm leading-relaxed text-slate-500'
          }
        />
      )}
    </div>
  )
}

/** Floating dialog shell (the original modal card). */
function ModalFrame({
  index,
  total,
  title,
  description,
  frame,
  branding,
  showBack,
  onBack,
  onExit,
  actions,
  hideTitleBlock,
  centerActions,
  fixedHeight,
  titleMaxWords,
  titleMaxChars,
  descriptionMaxChars,
  children,
}: StepFrameProps) {
  const { logo, meta } = useHeaderBits({ frame, branding, index, total, onExit })
  return (
    <div
      className="brand-surface flex flex-col overflow-hidden"
      style={{
        borderRadius: 'var(--brand-radius)',
        // Two-layer background paints the card fill inside the padding box and
        // the border paint in the border box, so both fill and border support
        // gradients while the rounded corners stay intact. Both layers are
        // background-images (see brand.ts) — a bare <color> in a non-final
        // background layer would invalidate the whole declaration.
        border: 'var(--brand-card-border-width) solid transparent',
        backgroundImage: 'var(--brand-card), var(--brand-card-border)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        boxShadow: 'var(--brand-card-shadow, 0 12px 40px -12px rgba(15, 23, 42, 0.18))',
        // The card is pinned to the current step's measured height and eased
        // between steps, so switching steps gently grows/shrinks the surface
        // instead of snapping. Falls back to a min height when unmeasured.
        ...(fixedHeight ? { height: fixedHeight } : { minHeight: 520 }),
        transition: 'height 280ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <ModalHeader logo={logo} meta={meta} />

      <div className="flex flex-1 flex-col px-8 py-7">
        {!hideTitleBlock && (
          <TitleBlock
            title={title}
            description={description}
            frame={frame}
            titleMaxWords={titleMaxWords}
            titleMaxChars={titleMaxChars}
            descriptionMaxChars={descriptionMaxChars}
          />
        )}
        <div className="flex-1">{children}</div>
      </div>

      <div
        className={`relative flex items-center border-t border-black/5 px-8 py-4 ${
          centerActions ? 'justify-center' : 'justify-between'
        }`}
      >
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`text-sm font-semibold ${centerActions ? 'absolute left-8' : ''}`}
            style={{ color: 'var(--brand-primary)' }}
          >
            Back
          </button>
        ) : (
          !centerActions && <span />
        )}
        <div className="flex items-center gap-3">{actions}</div>
      </div>
    </div>
  )
}

/**
 * Hosted full-page shell: the experience fills the whole screen on the branded
 * site background, with a full-width header bar, a centered content column, and
 * a full-width footer nav. Header/footer stay fixed while the content scrolls.
 */
function FullPageFrame({
  index,
  total,
  title,
  description,
  frame,
  branding,
  showBack,
  onBack,
  onExit,
  actions,
  hideTitleBlock,
  centerActions,
  titleMaxWords,
  titleMaxChars,
  descriptionMaxChars,
  children,
}: StepFrameProps) {
  const { device } = useRenderCtx()
  const { logo, meta } = useHeaderBits({ frame, branding, index, total, onExit })
  // Hosted-page canvas: a wide, left-aligned content band with generous
  // gutters (matching the reference), rather than a narrow centered column.
  const colMax = device === 'desktop' ? 1120 : device === 'tablet' ? 720 : undefined
  const padX = device === 'mobile' ? 'px-6' : 'px-12'
  return (
    <div
      className="brand-surface flex h-full flex-col"
      style={{
        backgroundColor: 'var(--brand-site)',
        backgroundImage: 'var(--brand-site-image, none)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Header bar — logo left, progress + exit right, hairline underline. */}
      <header className="flex-none border-b border-black/5" style={{ background: 'var(--brand-header, transparent)' }}>
        <div className={`mx-auto flex w-full items-center justify-between ${padX} py-5`} style={{ maxWidth: colMax }}>
          {logo}
          {meta}
        </div>
      </header>

      {/* Content — wide, left-aligned band. Top-aligned (never centered) so the
          title is always anchored at the top and the step fits within a single
          viewport without scrolling. */}
      <main className="min-h-0 flex-1 overflow-hidden">
        <div
          className={`mx-auto flex h-full w-full flex-col justify-start ${padX} py-5`}
          style={{ maxWidth: colMax }}
        >
          {!hideTitleBlock && (
          <TitleBlock
            title={title}
            description={description}
            frame={frame}
            titleMaxWords={titleMaxWords}
            titleMaxChars={titleMaxChars}
            descriptionMaxChars={descriptionMaxChars}
          />
        )}
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </main>

      {/* Footer nav bar — subtle band on the page background (no card fill). */}
      <footer className="flex-none border-t border-black/5" style={{ background: 'rgba(2, 6, 23, 0.025)' }}>
        <div
          className={`relative mx-auto flex w-full items-center ${padX} py-4 ${
            centerActions ? 'justify-center' : 'justify-between'
          }`}
          style={{ maxWidth: colMax }}
        >
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className={`text-sm font-semibold ${centerActions ? 'absolute left-12' : ''}`}
              style={{ color: 'var(--brand-primary)' }}
            >
              Back
            </button>
          ) : (
            !centerActions && <span />
          )}
          <div className="flex items-center gap-3">{actions}</div>
        </div>
      </footer>
    </div>
  )
}
