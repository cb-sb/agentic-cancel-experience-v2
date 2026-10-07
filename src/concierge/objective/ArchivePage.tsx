import { ArchiveGroup, ArchiveRow } from '../../layout/ArchivePage'
import { FRAME_WIDE } from '../../layout/frames'
import { PageHeader } from '../../layout/SlgChrome'
import { TableEmpty } from '../../layout/SlgTable'
import { audienceText } from '../../plays/resolve'
import { toast } from '../../plays/ui'
import { objectiveLabel, TYPE_ICON, TYPE_LABEL, type GrowthObjective } from '../model'
import { deleteArchivedGrowthExperience, unarchiveGrowthExperience, useGrowthExperiences } from '../useGrowthExperiences'
import { deleteArchivedGrowthPlay, unarchiveGrowthPlay, useGrowthPlays } from '../useGrowthPlays'

/** Acquisition or Expansion's archive, laid out like Retention's. */
export function GrowthArchivePage({ objective }: { objective: GrowthObjective }) {
  const allPlays = useGrowthPlays((s) => s.archived)
  const allExperiences = useGrowthExperiences((s) => s.archived)
  const plays = allPlays.filter((p) => p.objective === objective)
  const experiences = allExperiences.filter((x) => x.objective === objective)
  return (
    <div className="h-full min-w-0 flex-1 overflow-y-auto bg-white">
      <div className={`${FRAME_WIDE} px-[28px] pb-[48px] pt-[22px]`}>
        <PageHeader
          title="Archive"
          meta={[`${plays.length} play${plays.length === 1 ? '' : 's'}`, `${experiences.length} experience${experiences.length === 1 ? '' : 's'}`]}
        />
        <p className="mt-[12px] text-[13px] text-slate-500">
          {objectiveLabel(objective)} plays and experiences you put away. Subscribers don’t see anything here. Unarchive brings them back as drafts.
        </p>

        <ArchiveGroup title="Plays" count={plays.length} detail="Audience">
          {plays.length === 0 && <TableEmpty>No archived plays.</TableEmpty>}
          {plays.map((p) => (
            <ArchiveRow
              key={p.id}
              icon="users"
              title={p.name}
              detail={audienceText(p.audience)}
              at={p.archivedAt}
              onRestore={() => {
                unarchiveGrowthPlay(p.id)
                toast(`${p.name} is back as a draft, at the bottom of the play order.`)
              }}
              onDelete={() => deleteArchivedGrowthPlay(p.id)}
            />
          ))}
        </ArchiveGroup>

        <ArchiveGroup title="Experiences" count={experiences.length} detail="Type">
          {experiences.length === 0 && <TableEmpty>No archived experiences.</TableEmpty>}
          {experiences.map((x) => (
            <ArchiveRow
              key={x.id}
              icon={TYPE_ICON[x.type]}
              title={x.name}
              detail={TYPE_LABEL[x.type]}
              at={x.archivedAt}
              onRestore={() => {
                unarchiveGrowthExperience(x.id)
                toast(`${x.name} is back in Experiences. It isn't in any play.`)
              }}
              onDelete={() => deleteArchivedGrowthExperience(x.id)}
            />
          ))}
        </ArchiveGroup>
      </div>
    </div>
  )
}
