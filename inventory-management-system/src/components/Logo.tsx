export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          width="32"
          height="32"
          rx="7"
          fill={light ? '#991B1B' : '#0F172A'}
        />
        <path
          d="M8 11.5L16 7L24 11.5V20.5L16 25L8 20.5V11.5Z"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8 11.5L16 16M16 16L24 11.5M16 16V25"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <rect x="13" y="9.5" width="6" height="2" rx="1" fill="#FCA5A5" />
      </svg>
      {compact ? (
        <div className="min-w-0 leading-tight">
          <div
            className={`font-display text-xs font-bold tracking-wider uppercase ${
              light ? 'text-white' : 'text-slate-900'
            }`}
          >
            INVENTORY
          </div>
          <div
            className={`font-display text-[10px] font-semibold tracking-wider uppercase truncate ${
              light ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            MANAGEMENT SYSTEM
          </div>
        </div>
      ) : (
        <span
          className={`font-display text-sm font-bold tracking-tight whitespace-nowrap ${
            light ? 'text-white' : 'text-slate-900'
          }`}
        >
          INVENTORY MANAGEMENT SYSTEM
        </span>
      )}
    </div>
  );
}
