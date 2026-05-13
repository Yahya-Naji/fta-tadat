/**
 * Q Tax wordmark + monogram. The wordmark text adapts to light/dark theme;
 * the monogram is gradient-filled so it works on either background.
 */
export function QTaskMonogram({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-label="Q Tax"
    >
      <defs>
        <linearGradient id="q-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#00A89D" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#q-grad)" />
      <circle cx="20" cy="20" r="9.5" fill="none" stroke="white" strokeWidth="2.4" />
      <line x1="24" y1="24" x2="29" y2="29" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function QTaskWordmark({
  className = "",
  /** When true (e.g. over hero photo) text stays white regardless of theme */
  forceLight = false,
}: {
  className?: string;
  forceLight?: boolean;
}) {
  const titleClass = forceLight
    ? "text-white"
    : "text-gray-900 dark:text-white";
  const subtitleClass = forceLight
    ? "text-white/60"
    : "text-gray-500 dark:text-white/55";
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <QTaskMonogram size={32} />
      <div className="leading-none">
        <div className={`text-[15px] font-bold tracking-tight ${titleClass}`}>
          Q Tax
        </div>
        <div className={`mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] ${subtitleClass}`}>
          Tax Intelligence Studio
        </div>
      </div>
    </div>
  );
}
