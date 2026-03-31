export function StatCard({
  label,
  value,
  subtitle,
  isLoading = false
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  isLoading?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[24px] p-5 animate-fade-up"
      style={{ background: "#111111", border: "1px solid #1f1f1f" }}
    >
      {/* Amber top accent line */}
      <div
        className="absolute left-0 right-0 top-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, #c8a96e 0%, transparent 100%)" }}
      />

      <p
        className="text-[9px] font-medium uppercase tracking-[0.35em]"
        style={{ color: "#6b6560" }}
      >
        {label}
      </p>

      {isLoading ? (
        <>
          <div
            className="mt-4 h-10 w-20 animate-pulse rounded-full"
            style={{ background: "#1a1a1a", border: "1px solid #242424" }}
          />
          {subtitle && (
            <div
              className="mt-2 h-3 w-24 animate-pulse rounded-full"
              style={{ background: "#1a1a1a", border: "1px solid #242424" }}
            />
          )}
        </>
      ) : (
        <>
          <p
            className="mt-4 font-mono text-4xl font-medium leading-none"
            style={{ color: "#f5f0eb" }}
          >
            {value}
          </p>

          {subtitle && (
            <p className="mt-2 text-[11px]" style={{ color: "#6b6560" }}>
              {subtitle}
            </p>
          )}
        </>
      )}
    </div>
  );
}
