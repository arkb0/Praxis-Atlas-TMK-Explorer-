/** Wordmark and network-leaf mark used in the sidebar and mobile header. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="0.6" y="0.6" width="38.8" height="38.8" rx="11" fill="#10382C" stroke="#2A4C3E" />
      <path
        d="M20.5 8.5c-6 1.2-9.2 5-9.2 9.8 0 3.2 2.2 5.9 5.4 6.9 3.9-2.2 5.6-6.1 3.8-16.7z"
        fill="#F8D727"
      />
      <path d="M14.5 26.5c1.3-4.8 4-8.3 8.2-10.4" stroke="#0A2A21" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="27.2" cy="15" r="4.1" fill="#2F9FD9" />
      <circle cx="24.4" cy="27.2" r="4.1" fill="#6DAA8E" />
      <path d="M23.6 18.8 25.8 23.3M20 21.7l2.5 3.5" stroke="#EFF0E2" strokeOpacity="0.55" strokeWidth="1" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={compact ? 28 : 34} />
      <div className="leading-none">
        <div className="flex items-baseline gap-1.5">
          <span className="serif text-[21px] font-medium tracking-[-0.02em] text-sidebar-ink">Praxis</span>
          <span className="mono rounded-[3px] border border-sidebar-line px-1 py-[2px] text-[6.5px] uppercase tracking-[0.18em] text-sidebar-muted">
            Atlas
          </span>
        </div>
        {!compact && (
          <p className="mono mt-1.5 text-[7.5px] uppercase tracking-[0.17em] text-sidebar-muted">
            Task / Method / Knowledge
          </p>
        )}
      </div>
    </div>
  );
}
