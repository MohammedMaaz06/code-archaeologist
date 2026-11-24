export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 40 40"
      fill="none"
    >
      <path d="M20 6.5 28.5 11.5 20 16.5 11.5 11.5 20 6.5Z" />
      <path d="M11.5 17 20 22 28.5 17" />
      <path d="M11.5 22.5 20 27.5 28.5 22.5" />
      <path d="M11.5 28 20 33 28.5 28" />
      <circle cx="20" cy="11.5" r="1.4" />
      <circle cx="11.5" cy="17" r="1.4" />
      <circle cx="28.5" cy="17" r="1.4" />
      <circle className="brand-mark-accent" cx="20" cy="22" r="1.5" />
    </svg>
  );
}
