import Image from "next/image";

export function Logo({
  size = 30,
  withText = true,
  className = "",
}: {
  size?: number;
  withText?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      {/* Logo beyaz zeminli — karanlık modda kasıtlı bir rozet gibi durur */}
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/5"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.jpg"
          alt="Anatolia Aero Design logosu"
          width={size}
          height={size}
          priority
          className="object-contain"
          style={{ width: size * 0.86, height: size * 0.86 }}
        />
      </span>
      {withText && (
        <span className="display text-[17px] leading-none text-ink">
          Anatolia<span className="text-accent">.</span>
        </span>
      )}
    </span>
  );
}
