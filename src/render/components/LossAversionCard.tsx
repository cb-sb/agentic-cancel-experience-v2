import { LA_MAX_ITEMS, type LAListItem, type LossAversionComponent, type MediaAsset } from '../../types/experience'
import { uid } from '../../lib/id'
import {
  EditableText,
  InlineAddIconButton,
  InlineDeleteButton,
  useComponentEdit,
} from '../Editable'
import { MediaBlock } from './MediaBlock'

function CheckIcon() {
  return (
    <span
      className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full"
      style={{ background: '#dcfce7', color: '#16a34a' }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  )
}

function CrossIcon() {
  return (
    <span
      className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full"
      style={{ background: '#fee2e2', color: '#dc2626' }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </span>
  )
}

function FeatureList({
  title,
  items,
  tone,
  onTitleCommit,
  onItemCommit,
  onItemRemove,
  onItemAdd,
}: {
  title?: string
  items?: LAListItem[]
  tone: 'keep' | 'lose'
  onTitleCommit: (v: string) => void
  onItemCommit: (id: string, patch: Partial<LAListItem>) => void
  onItemRemove: (id: string) => void
  onItemAdd: () => void
}) {
  if (!items || items.length === 0) return null
  const canDelete = items.length > 1
  const canAdd = items.length < LA_MAX_ITEMS
  return (
    <div>
      {title !== undefined && (
        <EditableText
          as="h4"
          value={title}
          onCommit={onTitleCommit}
          placeholder="List title"
          singleLine
          maxChars={28}
          className="mb-2 text-sm font-bold text-slate-900"
          style={{ fontFamily: 'var(--brand-font-heading)' }}
        />
      )}
      <ul className="space-y-2.5">
        {items.slice(0, LA_MAX_ITEMS).map((item) => (
          <li key={item.id} className="group/item flex items-start gap-2.5 text-sm">
            {tone === 'keep' ? <CheckIcon /> : <CrossIcon />}
            {/* Benefit lines never wrap: their intrinsic width sets the card's
                minimum, so the paired component yields space instead. */}
            <div className="flex-1 whitespace-nowrap text-slate-600">
              {/* Add + delete hug the end of the line being edited. When the
                  section is at its 3-item cap, only delete is offered. */}
              <span className="inline-flex items-center gap-0.5 align-top">
                <EditableText
                  value={item.label}
                  onCommit={(v) => onItemCommit(item.id, { label: v })}
                  placeholder="Item"
                  singleLine
                  maxChars={42}
                  className="whitespace-nowrap font-medium text-slate-700"
                />
                {canAdd && (
                  <InlineAddIconButton
                    onAdd={onItemAdd}
                    title="Add benefit"
                    className="opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100"
                  />
                )}
                <InlineDeleteButton
                  onRemove={() => onItemRemove(item.id)}
                  disabled={!canDelete}
                  title="Remove item"
                  className="opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100"
                />
              </span>
              {item.detail !== undefined && (
                <EditableText
                  as="span"
                  value={item.detail}
                  onCommit={(v) => onItemCommit(item.id, { detail: v })}
                  placeholder="Detail"
                  maxChars={56}
                  className="block text-[13px] leading-snug text-slate-400"
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LossAversionCard({
  component,
  dense = false,
}: {
  component: LossAversionComponent
  dense?: boolean
}) {
  const { cardType, media } = component
  const set = useComponentEdit(component.id)

  const onMediaChange = (patch: Partial<MediaAsset>) =>
    set({ media: { type: 'image', ...(component.media ?? {}), ...patch } })
  const mediaEl = media ? <MediaBlock media={media} onChange={onMediaChange} /> : null

  const updateItems = (
    field: 'keepItems' | 'loseItems',
    id: string,
    patch: Partial<LAListItem>,
  ) => {
    const arr = (component[field] ?? []).map((it) => (it.id === id ? { ...it, ...patch } : it))
    set({ [field]: arr })
  }
  const removeItem = (field: 'keepItems' | 'loseItems', id: string) =>
    set({ [field]: (component[field] ?? []).filter((it) => it.id !== id) })
  const addItem = (field: 'keepItems' | 'loseItems') =>
    set({ [field]: [...(component[field] ?? []), { id: uid('it'), label: 'New item' }] })

  if (cardType === 'message') {
    return (
      <div className={dense ? '' : 'space-y-5'}>
        {!dense && mediaEl}
        <EditableText
          as="div"
          value={component.message ?? ''}
          onCommit={(v) => set({ message: v })}
          placeholder="Write a personal message…"
          className="border-l-2 pl-4 text-[15px] italic text-slate-600"
          style={{ borderColor: 'var(--brand-accent)', lineHeight: 1.4 }}
        />
      </div>
    )
  }

  if (cardType === 'account_activity') {
    return (
      <div className={dense ? '' : 'space-y-5'}>
        {!dense && mediaEl}
        {component.statsTitle !== undefined && (
          <EditableText
            as="h4"
            value={component.statsTitle}
            onCommit={(v) => set({ statsTitle: v })}
            placeholder="Stats title"
            singleLine
            className="text-xs font-bold uppercase tracking-wider text-slate-400"
          />
        )}
        <div className={`grid gap-4 ${dense ? 'grid-cols-1' : 'grid-cols-3'}`}>
          {(component.stats ?? []).map((s) => (
            <div key={s.id}>
              <EditableText
                as="div"
                value={s.value}
                onCommit={(v) =>
                  set({
                    stats: (component.stats ?? []).map((x) =>
                      x.id === s.id ? { ...x, value: v } : x,
                    ),
                  })
                }
                singleLine
                className="text-2xl font-bold text-slate-900"
                style={{ fontFamily: 'var(--brand-font-heading)' }}
              />
              <EditableText
                as="div"
                value={s.label}
                onCommit={(v) =>
                  set({
                    stats: (component.stats ?? []).map((x) =>
                      x.id === s.id ? { ...x, label: v } : x,
                    ),
                  })
                }
                singleLine
                className="text-[13px] text-slate-500"
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // feature_list
  const lists = (
    <div className="space-y-5">
      <FeatureList
        title={component.keepTitle}
        items={component.keepItems}
        tone="keep"
        onTitleCommit={(v) => set({ keepTitle: v })}
        onItemCommit={(id, patch) => updateItems('keepItems', id, patch)}
        onItemRemove={(id) => removeItem('keepItems', id)}
        onItemAdd={() => addItem('keepItems')}
      />
      <FeatureList
        title={component.loseTitle}
        items={component.loseItems}
        tone="lose"
        onTitleCommit={(v) => set({ loseTitle: v })}
        onItemCommit={(id, patch) => updateItems('loseItems', id, patch)}
        onItemRemove={(id) => removeItem('loseItems', id)}
        onItemAdd={() => addItem('loseItems')}
      />
    </div>
  )

  if (media && !dense) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
        {mediaEl}
        {lists}
      </div>
    )
  }

  return lists
}
