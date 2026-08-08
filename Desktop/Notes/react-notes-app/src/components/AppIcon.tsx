function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function AppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={classNames("shrink-0", className)}
      fill="none"
    >
      <defs>
        <linearGradient id="app-icon-bg" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id="app-icon-shine" x1="12" y1="6" x2="36" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <rect x="5" y="3" width="38" height="42" rx="11" fill="url(#app-icon-bg)" />
      <rect x="7" y="5" width="34" height="38" rx="9" fill="white" fillOpacity="0.08" />
      <path d="M9 12C9 8.68629 11.6863 6 15 6H33C36.3137 6 39 8.68629 39 12V13H9V12Z" fill="url(#app-icon-shine)" fillOpacity="0.55" />
      <rect x="12" y="10" width="24" height="3" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="12" y="16" width="15" height="2.5" rx="1.25" fill="white" fillOpacity="0.6" />
      <rect x="12" y="24" width="24" height="2.2" rx="1.1" fill="white" fillOpacity="0.38" />
      <rect x="12" y="29" width="24" height="2.2" rx="1.1" fill="white" fillOpacity="0.38" />
      <rect x="12" y="34" width="18" height="2.2" rx="1.1" fill="white" fillOpacity="0.28" />
      <circle cx="34.5" cy="17.5" r="3.2" fill="#FFFFFF" fillOpacity="0.18" />
      <circle cx="34.5" cy="17.5" r="1.1" fill="#FFFFFF" fillOpacity="0.9" />
    </svg>
  );
}
