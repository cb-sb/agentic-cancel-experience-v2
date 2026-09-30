export function StatusChip({ live, liveLabel = 'Live' }: { live: boolean; liveLabel?: string }) {
  return (
    <span
      className={`flex-none rounded-full px-[7px] py-[1px] text-[10.5px] font-semibold ${
        live ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/80 text-slate-600'
      }`}
    >
      {live ? liveLabel : 'Draft'}
    </span>
  )
}
