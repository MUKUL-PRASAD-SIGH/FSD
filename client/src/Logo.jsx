// HackElite mark: a faceted "A" in blue, cyan and lime. Decorative (aria-hidden); the wordmark carries the name.
export default function Logo({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="he-a" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#145BFF" /><stop offset=".55" stopColor="#22C8FF" /><stop offset="1" stopColor="#C6FF00" /></linearGradient>
      </defs>
      <path d="M24 4 5 42h9l10-21 10 21h9L24 4Z" fill="url(#he-a)" />
      <path d="M24 22 17 36h14l-7-14Z" fill="#080B10" opacity=".55" />
    </svg>
  );
}
