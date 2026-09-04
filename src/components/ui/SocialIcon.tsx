/* lucide v1'de marka ikonları yok — satır içi SVG'ler */

type Props = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  "aria-hidden": true as const,
});

export function InstagramIcon({ size = 16, className = "" }: Props) {
  return (
    <svg
      {...base(size)}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YoutubeIcon({ size = 16, className = "" }: Props) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M23.5 6.9a3 3 0 0 0-2.1-2.1C19.5 4.3 12 4.3 12 4.3s-7.5 0-9.4.5A3 3 0 0 0 .5 6.9C0 8.8 0 12 0 12s0 3.2.5 5.1a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.1.5-5.1s0-3.2-.5-5.1zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}

export function TiktokIcon({ size = 16, className = "" }: Props) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M16.6 5.8a4.8 4.8 0 0 1-1.1-2.8h-3v12.3a2.7 2.7 0 1 1-2-2.6V9.6a5.8 5.8 0 1 0 5 5.7V9.1a7.8 7.8 0 0 0 4.5 1.4V7.5a4.8 4.8 0 0 1-3.4-1.7z" />
    </svg>
  );
}

export function LinkedinIcon({ size = 16, className = "" }: Props) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M20.4 20.4h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.05a3.8 3.8 0 0 1 3.4-1.9c3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.4H3.5V9h3.6v11.4zM22.2 0H1.8A1.8 1.8 0 0 0 0 1.8v20.4A1.8 1.8 0 0 0 1.8 24h20.4a1.8 1.8 0 0 0 1.8-1.8V1.8A1.8 1.8 0 0 0 22.2 0z" />
    </svg>
  );
}

const MAP = {
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  linkedin: LinkedinIcon,
} as const;

export function SocialIcon({
  name,
  size = 16,
  className = "",
}: {
  name: keyof typeof MAP;
  size?: number;
  className?: string;
}) {
  const C = MAP[name];
  return <C size={size} className={className} />;
}
