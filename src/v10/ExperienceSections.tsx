import { useEffect } from 'react'
import { create } from 'zustand'
import { CATEGORY_LABEL, objectiveLabel, type GrowthObjective } from '../concierge/model'
import { createGrowthOffer, createPricingTable, OffersPage, PricingTablesPage } from '../concierge/LibraryPages'
import { startFromTemplate } from '../concierge/objective/actions'
import { templatesFor } from '../concierge/objective/templates'
import { TemplatesPage } from '../concierge/objective/TemplatesPage'
import { Empty } from '../concierge/objective/ui'
import { useGrowthLibrary } from '../concierge/useGrowthLibrary'
import { LibraryPage } from '../library/LibraryPage'
import { useCancelLibrary } from '../library/useCancelLibrary'
import { offerVariantLabel } from '../lib/offerVariants'
import { LibraryBrowse } from '../orchestration/LibraryBrowse'
import type { MenuItem } from '../plays/ui'
import { startFromLibraryNow, useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi, type LibraryKind } from '../workspace/useWorkspaceUi'
import { V10_GUTTER } from './V10Table'
import { openRef, useV10, type ComponentPart, type ExperienceSection, type LibraryObjective } from './useV10'

export const SECTIONS: { id: ExperienceSection; label: string }[] = [
  { id: 'all', label: 'All experiences' },
  { id: 'templates', label: 'Templates' },
  { id: 'components', label: 'Components' },
]

const PARTS: { id: ComponentPart; label: string; add: string }[] = [
  { id: 'reasons', label: 'Survey reasons', add: 'New survey reason' },
  { id: 'cards', label: 'Loss aversion cards', add: 'New loss aversion card' },
  { id: 'confirmations', label: 'Confirmations', add: 'New confirmation page' },
  { id: 'redirects', label: 'Redirect pages', add: 'New redirect page' },
  { id: 'pricing_tables', label: 'Pricing tables', add: 'New pricing table' },
]

const TEMPLATE_OBJECTIVES: { id: LibraryObjective; label: string }[] = [
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'expansion', label: 'Expansion' },
  { id: 'retention', label: 'Retention' },
]
const OFFER_OBJECTIVES: { id: LibraryObjective; label: string }[] = [{ id: 'all', label: 'All' }, ...TEMPLATE_OBJECTIVES]
const GROWTH_OBJECTIVES = TEMPLATE_OBJECTIVES.slice(0, 2)

/** The item a click outside the page asked to open. `at` remounts the page so the same item can open twice. */
const useSectionFocus = create<{ id: string | null; at: number }>(() => ({ id: null, at: 0 }))

function focus(id: string) {
  useSectionFocus.setState({ id, at: Date.now() })
}

function templateObjective(objective: LibraryObjective): Exclude<LibraryObjective, 'all'> {
  return objective === 'all' ? 'acquisition' : objective
}

function growthObjective(objective: LibraryObjective): GrowthObjective {
  return objective === 'expansion' ? 'expansion' : 'acquisition'
}

/** Point the cancel library at one kind, and optionally open a new item or an existing one. */
function showLibrary(kind: LibraryKind, opts: { create?: boolean; focus?: string } = {}) {
  useWorkspaceUi.setState((s) => ({
    libraryKind: kind,
    libraryNew: opts.create ? s.libraryNew + 1 : s.libraryNew,
    libraryFocus: opts.focus ?? null,
  }))
}

function openRetentionExperience() {
  openRef({ kind: 'experience', source: 'retention', id: useWorkspace.getState().activeId })
}

function growthOfferItems(objective: GrowthObjective): MenuItem[] {
  return [
    {
      label: 'Blank offer',
      icon: 'plus',
      onClick: () => {
        useV10.getState().setSection({ section: 'offers', libraryObjective: objective })
        focus(createGrowthOffer(objective))
      },
    },
    ...templatesFor(objective, 'in_app_offer').map((t) => ({
      label: t.name,
      icon: 'layout-template' as const,
      hint: 'From a template, as a new experience',
      onClick: () => startFromTemplate(objective, t, null),
    })),
  ]
}

/** What New makes on each Experiences tab. Null hides the button. */
export function sectionNewItems(section: ExperienceSection, part: ComponentPart, objective: LibraryObjective): MenuItem[] | null {
  if (section === 'templates') return null
  if (section === 'components') {
    if (part === 'pricing_tables') {
      const target = growthObjective(objective)
      return [
        {
          label: 'Blank pricing table',
          icon: 'plus',
          onClick: () => {
            useV10.getState().setSection({ libraryObjective: target })
            focus(createPricingTable(target))
          },
        },
        ...templatesFor(target, 'pricing_table').map((t) => ({
          label: t.name,
          icon: 'layout-template' as const,
          hint: 'From a template, as a new experience',
          onClick: () => startFromTemplate(target, t, null),
        })),
      ]
    }
    const meta = PARTS.find((item) => item.id === part)!
    return [{ label: meta.add, icon: 'plus', onClick: () => showLibrary(part as LibraryKind, { create: true }) }]
  }
  if (section === 'offers') {
    const retention: MenuItem = {
      label: 'Retention offer',
      icon: 'repeat',
      onClick: () => {
        useV10.getState().setSection({ section: 'offers', libraryObjective: 'retention' })
        showLibrary('offers', { create: true })
      },
    }
    if (objective === 'retention') return [retention]
    if (objective === 'acquisition' || objective === 'expansion') return growthOfferItems(objective)
    return [
      { label: 'Acquisition offer', icon: 'rocket', items: growthOfferItems('acquisition') },
      { label: 'Expansion offer', icon: 'arrow-up-right', items: growthOfferItems('expansion') },
      retention,
    ]
  }
  return null
}

function Pills<T extends string>({ label, items, value, onChange }: { label: string; items: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div role="tablist" aria-label={label} className="flex h-full min-w-0 items-center gap-[8px]">
      {items.map((item) => {
        const on = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(item.id)}
            className={`relative flex h-full items-center whitespace-nowrap px-[16px] text-[13px] ${on ? 'font-semibold text-[#111827]' : 'text-[#6b7280] hover:text-[#111827]'}`}
          >
            {item.label}
            {on && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-[#111827]" />}
          </button>
        )
      })}
    </div>
  )
}

/** The second row of the view bar on the Templates, Components and Offers tabs. */
export function SectionFilters({ section }: { section: ExperienceSection }) {
  const part = useV10((state) => state.part)
  const objective = useV10((state) => state.libraryObjective)
  const set = useV10((state) => state.setSection)
  if (section === 'templates') {
    return <Pills label="Template objective" items={TEMPLATE_OBJECTIVES} value={templateObjective(objective)} onChange={(id) => set({ libraryObjective: id })} />
  }
  if (section === 'offers') {
    return <Pills label="Offer objective" items={OFFER_OBJECTIVES} value={objective} onChange={(id) => set({ libraryObjective: id })} />
  }
  if (section === 'components') {
    return (
      <div className="flex h-full min-w-0 flex-1 items-center justify-between gap-[12px]">
        <Pills label="Component kind" items={PARTS} value={part} onChange={(id) => set({ part: id })} />
        {part === 'pricing_tables' && (
          <Pills label="Pricing table objective" items={GROWTH_OBJECTIVES} value={growthObjective(objective)} onChange={(id) => set({ libraryObjective: id })} />
        )}
      </div>
    )
  }
  return null
}

/** The page under the view bar on the Templates, Components and Offers tabs. */
export function ExperienceSectionBody({ section }: { section: ExperienceSection }) {
  const part = useV10((state) => state.part)
  const objective = useV10((state) => state.libraryObjective)
  const focused = useSectionFocus()
  useEffect(() => {
    if (focused.id) useSectionFocus.setState({ id: null })
  }, [focused.id])
  return (
    <div className="min-h-0 flex-1">
      {section === 'templates' && <Templates objective={templateObjective(objective)} />}
      {section === 'components' &&
        (part === 'pricing_tables' ? (
          <PricingTablesPage key={`${growthObjective(objective)}:${focused.at}`} objective={growthObjective(objective)} embedded focusId={focused.id} />
        ) : (
          <CancelLibrary kind={part} />
        ))}
      {section === 'offers' &&
        (objective === 'retention' ? (
          <CancelLibrary kind="offers" />
        ) : objective === 'all' ? (
          <AllOffers />
        ) : (
          <OffersPage key={`${objective}:${focused.at}`} objective={objective} embedded focusId={focused.id} />
        ))}
    </div>
  )
}

function CancelLibrary({ kind }: { kind: LibraryKind }) {
  const current = useWorkspaceUi((state) => state.libraryKind)
  useEffect(() => {
    if (useWorkspaceUi.getState().libraryKind !== kind) showLibrary(kind)
  }, [kind])
  return current === kind ? <LibraryPage embedded /> : null
}

function Templates({ objective }: { objective: Exclude<LibraryObjective, 'all'> }) {
  if (objective !== 'retention') return <TemplatesPage objective={objective} embedded />
  return <RetentionTemplates />
}

/** Cancel page templates. Saved components attach to the open journey, so they stay in the cancel page editor. */
function RetentionTemplates() {
  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain bg-white">
      <LibraryBrowse
        kind="cancel"
        onApply={(id) => {
          startFromLibraryNow(id)
          openRetentionExperience()
        }}
      />
    </div>
  )
}

interface OfferRow {
  id: string
  name: string
  objective: Exclude<LibraryObjective, 'all'>
  type: string
  status: string
}

/** Every offer from both libraries. Opening one moves to its objective's tab. */
function AllOffers() {
  const growth = useGrowthLibrary((state) => state.offers)
  const retention = useCancelLibrary((state) => state.offers)
  const rows: OfferRow[] = [
    ...growth
      .filter((offer) => offer.status !== 'archived' && offer.objective !== 'retention')
      .map((offer) => ({
        id: offer.id,
        name: offer.name,
        objective: offer.objective as Exclude<LibraryObjective, 'all'>,
        type: CATEGORY_LABEL[offer.category],
        status: offer.status === 'published' ? 'Published' : 'Draft',
      })),
    ...retention.map((offer) => ({ id: offer.id, name: offer.name, objective: 'retention' as const, type: offerVariantLabel(offer.type), status: 'Saved' })),
  ]
  const open = (row: OfferRow) => {
    useV10.getState().setSection({ libraryObjective: row.objective })
    if (row.objective === 'retention') showLibrary('offers', { focus: row.id })
    else focus(row.id)
  }
  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className={`pb-[48px] pt-[16px] ${V10_GUTTER}`}>
        {rows.length === 0 ? (
          <Empty>No offers yet.</Empty>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[12px] font-medium text-slate-400">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Objective</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.objective}:${row.id}`} className="border-t border-slate-100">
                  <td className="py-3">
                    <button type="button" className="font-medium text-slate-900 hover:underline" onClick={() => open(row)}>
                      {row.name}
                    </button>
                  </td>
                  <td className="py-3 text-slate-600">{row.objective === 'retention' ? 'Retention' : objectiveLabel(row.objective)}</td>
                  <td className="py-3 text-slate-600">{row.type}</td>
                  <td className="py-3 text-slate-600">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
