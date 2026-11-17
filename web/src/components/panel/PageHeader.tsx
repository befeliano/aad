export function PageHeader({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="display-tight text-balance text-[clamp(1.6rem,7vw,1.875rem)] text-ink sm:text-4xl">
          {title}
        </h1>
        {desc && (
          <p className="mt-2 max-w-xl text-sm break-words text-ink-2">{desc}</p>
        )}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
