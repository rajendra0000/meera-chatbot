import { fileUrl } from "../lib/api";
import { Lead } from "../types";

const segments = [
  { key: "budget", label: "Budget Alignment", max: 30 },
  { key: "space", label: "Space / Area", max: 20 },
  { key: "productInterest", label: "Product Interest", max: 15 },
  { key: "timeline", label: "Timeline", max: 10 },
  { key: "engagement", label: "Engagement Quality", max: 25 }
] as const;

export function LeadModal({
  lead,
  isLoading = false,
  leadLabel,
  onClose,
  onTriggerFollowUp
}: {
  lead: Lead | null;
  isLoading?: boolean;
  leadLabel?: string | null;
  onClose: () => void;
  onTriggerFollowUp: () => void;
}) {
  if (!lead && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      >
        <div
          className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-[28px] p-6 animate-fade-up"
          style={{
            background: "#111111",
            border: "1px solid #1f1f1f",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
                Lead Detail
              </p>
              <h2
                className="mt-1.5 leading-tight"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: "30px",
                  fontWeight: 600,
                  color: "#f5f0eb"
                }}
              >
                {leadLabel ?? "Loading lead..."}
              </h2>
              <div
                className="mt-2 h-4 w-40 animate-pulse rounded-full"
                style={{ background: "#1a1a1a", border: "1px solid #242424" }}
              />
            </div>
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm btn-ghost">
              Close
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-5">
              <section className="rounded-[20px] p-5" style={{ background: "#161616", border: "1px solid #1f1f1f" }}>
                <h3 className="text-base font-semibold" style={{ color: "#f5f0eb" }}>
                  Score Breakdown
                </h3>
                <div className="mt-4 space-y-4">
                  {segments.map((segment) => (
                    <div key={segment.key}>
                      <div className="mb-2 flex items-center justify-between">
                        <div
                          className="h-3 w-28 animate-pulse rounded-full"
                          style={{ background: "#1a1a1a", border: "1px solid #242424" }}
                        />
                        <div
                          className="h-3 w-12 animate-pulse rounded-full"
                          style={{ background: "#1a1a1a", border: "1px solid #242424" }}
                        />
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "#1f1f1f" }}>
                        <div className="h-1.5 w-2/3 animate-pulse rounded-full" style={{ background: "#2a2a2a" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[20px] p-5" style={{ background: "#161616", border: "1px solid #1f1f1f" }}>
                <h3 className="text-base font-semibold" style={{ color: "#f5f0eb" }}>
                  Conversation Transcript
                </h3>
                <div className="mt-4 space-y-3">
                  {[60, 72, 54, 68].map((width, index) => (
                    <div key={width} className={`flex ${index % 2 === 0 ? "justify-end" : "justify-start"}`}>
                      <div
                        className="h-12 animate-pulse rounded-[20px]"
                        style={{
                          width: `${width}%`,
                          background: index % 2 === 0 ? "rgba(200,169,110,0.08)" : "#1f1f1f",
                          border: "1px solid #2a2a2a"
                        }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[18px] p-4"
                    style={{ background: "#1c1c1c", border: "1px solid #1f1f1f" }}
                  >
                    <div
                      className="h-3 w-16 animate-pulse rounded-full"
                      style={{ background: "#1a1a1a", border: "1px solid #242424" }}
                    />
                    <div
                      className="mt-3 h-6 w-20 animate-pulse rounded-full"
                      style={{ background: "#1a1a1a", border: "1px solid #242424" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  const detailCards = [
    { label: "Score", value: lead.score, mono: true, highlight: "amber" as const },
    { label: "Status", value: lead.status, mono: false, highlight: null },
    { label: "Investment", value: lead.investmentRange ?? "-", mono: false, highlight: null },
    {
      label: "Est. Value",
      value: lead.estimatedOrderValue ? `Rs ${lead.estimatedOrderValue.toLocaleString("en-IN")}` : "-",
      mono: true,
      highlight: lead.estimatedOrderValue ? ("green" as const) : null
    },
    { label: "Area", value: lead.areaSqft ?? "-", mono: true, highlight: null },
    { label: "Trigger", value: lead.triggerType ?? "-", mono: true, highlight: null }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-[28px] p-6 animate-fade-up"
        style={{
          background: "#111111",
          border: "1px solid #1f1f1f",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
              Lead Detail
            </p>
            <h2
              className="mt-1.5 leading-tight"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: "30px",
                fontWeight: 600,
                color: "#f5f0eb"
              }}
            >
              {lead.name}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "#b8b0a4" }}>
              {lead.productInterest}
              {lead.showroomCity ? ` - ${lead.showroomCity}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a href={fileUrl(`/dashboard/leads/${lead.id}/export.csv`)} className="rounded-full px-4 py-2 text-sm btn-ghost">
              Export Lead
            </a>
            <button onClick={onTriggerFollowUp} className="rounded-full px-4 py-2 text-sm font-semibold btn-amber">
              Trigger Follow-up
            </button>
            <button onClick={onClose} className="rounded-full px-4 py-2 text-sm btn-ghost">
              Close
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-5">
            <section className="rounded-[20px] p-5" style={{ background: "#161616", border: "1px solid #1f1f1f" }}>
              <h3 className="text-base font-semibold" style={{ color: "#f5f0eb" }}>
                Score Breakdown
              </h3>
              <div className="mt-4 space-y-4">
                {segments.map((segment) => {
                  const value = lead.leadScore?.[segment.key] ?? 0;
                  const pct = (value / segment.max) * 100;

                  return (
                    <div key={segment.key}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span style={{ color: "#b8b0a4" }}>{segment.label}</span>
                        <span className="font-mono text-xs font-medium" style={{ color: "#e2c98f" }}>
                          {value}/{segment.max}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "#1f1f1f" }}>
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: "linear-gradient(90deg, #c8a96e, #e2c98f)"
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[20px] p-5" style={{ background: "#161616", border: "1px solid #1f1f1f" }}>
              <h3 className="text-base font-semibold" style={{ color: "#f5f0eb" }}>
                Conversation Transcript
              </h3>
              <div className="mt-4 space-y-3">
                {(lead.conversation?.messages ?? []).map((message, index) => {
                  const role = message.role.toLowerCase();
                  const key = message.id ?? `${role}-${index}`;

                  if (role === "user") {
                    return (
                      <div key={key} className="flex justify-end">
                        <div
                          className="max-w-[80%] rounded-[20px_20px_4px_20px] px-3 py-2 text-sm leading-relaxed"
                          style={{
                            background: "rgba(200,169,110,0.1)",
                            border: "1px solid rgba(200,169,110,0.2)",
                            color: "#f5f0eb"
                          }}
                        >
                          {message.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={key} className="flex justify-start">
                      <div
                        className="max-w-[80%] rounded-[20px_20px_20px_4px] px-3 py-2 text-sm leading-relaxed"
                        style={{
                          background: "#1f1f1f",
                          border: "1px solid #2a2a2a",
                          color: "#b8b0a4"
                        }}
                      >
                        {message.content}
                      </div>
                    </div>
                  );
                })}
                {!(lead.conversation?.messages ?? []).length && (
                  <p className="text-sm" style={{ color: "#6b6560" }}>
                    No transcript available.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div>
            <div className="grid grid-cols-2 gap-3">
              {detailCards.map(({ label, value, mono, highlight }) => (
                <div
                  key={label}
                  className="rounded-[18px] p-4"
                  style={{ background: "#1c1c1c", border: "1px solid #1f1f1f" }}
                >
                  <p className="text-[9px] font-medium uppercase tracking-[0.25em]" style={{ color: "#6b6560" }}>
                    {label}
                  </p>
                  <p
                    className={`mt-3 text-lg font-semibold leading-tight ${mono ? "font-mono" : ""}`}
                    style={{
                      color:
                        highlight === "amber" ? "#e2c98f" : highlight === "green" ? "#4ade80" : "#f5f0eb"
                    }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
