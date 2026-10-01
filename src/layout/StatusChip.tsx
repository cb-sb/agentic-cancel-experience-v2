export function StatusChip({ live }: { live: boolean }) {
  return (
    <span
      className={`flex-none rounded-full px-[7px] py-[1px] text-[10.5px] font-semibold ${
        live ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/80 text-slate-600'
      }`}
    >
      {live ? 'Live' : 'Draft'}
    </span>
  )
}
