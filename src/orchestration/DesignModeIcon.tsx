/**
 * Annotate / visual-edit mark — a selectable UI frame with a cursor, the same
 * shape Cursor design mode and Lovable visual edit use. Not a lone pointer.
 */
export function DesignModeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect
        x="3.25"
        y="3.25"
        width="11.5"
        height="11.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeDasharray="2.4 1.8"
      />
      <path
        d="M12.6 12.2 14.35 21.3l2.2-2.7 3.35 3.35 1.25-1.25-3.35-3.35 2.7-2.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
