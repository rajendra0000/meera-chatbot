import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, fileUrl } from "../lib/api";
import { DashboardStats, FollowUpLayer, Lead } from "../types";
import { StatCard } from "../components/StatCard";
import { LeadModal } from "../components/LeadModal";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const filters = [
  { label: "All", value: "all" },
  { label: "Hot", value: "hot" },
  { label: "Warm", value: "warm" },
  { label: "Wants Callback", value: "callback" },
  { label: "Wants Sample", value: "sample" }
] as const;

const CSV_HEADERS =
  "name,score,status,interest,investment,area_sqft,room_type,style,city,timeline,trigger,wants_callback,wants_sample,estimated_order_value,created_at";

type FollowUpPreview = {
  leadId: string;
  layers: FollowUpLayer[];
};

function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined || String(value).trim() === ""
      ? "Not specified"
      : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsvRow(lead: Lead): string {
  const collectedData = lead.conversation?.collectedData ?? {};
  const conversationStatus = lead.conversation?.status ?? lead.status;

  return [
    lead.name,
    lead.score,
    conversationStatus,
    lead.productInterest,
    lead.investmentRange,
    lead.areaSqft ?? "Not specified",
    collectedData.roomType ?? "Not specified",
    collectedData.style ?? "Not specified",
    lead.showroomCity ?? collectedData.city ?? "Not specified",
    lead.timeline,
    lead.triggerType,
    lead.wantsCallback,
    lead.wantsSample,
    lead.estimatedOrderValue ?? "Not specified",
    lead.createdAt
  ].map(csvCell).join(",");
}

function skeletonBox(width: string, height = "12px") {
  return (
    <div
      className="animate-pulse rounded-full"
      style={{ width, height, background: "#1a1a1a", border: "1px solid #242424" }}
    />
  );
}

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get("tab") === "all" ? "all" : "all";
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    hotLeads: 0,
    warmLeads: 0,
    avgScore: 0,
    mostCommonTrigger: "â€”"
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>(initialFilter);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadLabel, setSelectedLeadLabel] = useState<string | null>(null);
  const [followUpPreview, setFollowUpPreview] = useState<FollowUpPreview | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedLayer, setCopiedLayer] = useState<number | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isLeadsLoading, setIsLeadsLoading] = useState(true);
  const [isLeadDetailLoading, setIsLeadDetailLoading] = useState(false);
  const [hasLoadedStats, setHasLoadedStats] = useState(false);
  const [hasLoadedLeads, setHasLoadedLeads] = useState(false);

  useEffect(() => {
    if (searchParams.get("tab") === "all") {
      setFilter("all");
    }
  }, [searchParams]);

  async function loadStats(showLoader = !hasLoadedStats) {
    if (showLoader) {
      setIsStatsLoading(true);
    }

    try {
      setStats(await api<DashboardStats>("/dashboard/stats"));
      setHasLoadedStats(true);
    } finally {
      setIsStatsLoading(false);
    }
  }

  async function loadLeads(nextFilter = filter, showLoader = !hasLoadedLeads) {
    if (showLoader) {
      setIsLeadsLoading(true);
    }

    try {
      const query = nextFilter === "all" ? "" : `?filter=${nextFilter}`;
      setLeads(await api<Lead[]>(`/dashboard/leads${query}`));
      setHasLoadedLeads(true);
    } finally {
      setIsLeadsLoading(false);
    }
  }

  async function fetchDashboard(
    nextFilter = filter,
    options: { showStatsLoader?: boolean; showLeadsLoader?: boolean } = {}
  ) {
    await Promise.all([
      loadStats(options.showStatsLoader ?? !hasLoadedStats),
      loadLeads(nextFilter, options.showLeadsLoader ?? !hasLoadedLeads)
    ]);
  }

  useEffect(() => {
    void fetchDashboard(filter, {
      showStatsLoader: !hasLoadedStats,
      showLeadsLoader: !hasLoadedLeads
    });
  }, [filter]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchDashboard(filter, { showStatsLoader: false, showLeadsLoader: false });
    }, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  async function openLead(lead: Lead) {
    setSelectedLead(null);
    setSelectedLeadLabel(lead.name ?? "Lead");
    setIsLeadDetailLoading(true);

    try {
      setSelectedLead(await api<Lead>(`/dashboard/leads/${lead.id}`));
    } catch {
      setSelectedLead(null);
      setSelectedLeadLabel(null);
    } finally {
      setIsLeadDetailLoading(false);
    }
  }

  function closeLead() {
    setSelectedLead(null);
    setSelectedLeadLabel(null);
    setIsLeadDetailLoading(false);
  }

  async function loadDemo() {
    await api("/dashboard/demo/load", { method: "POST" });
    await fetchDashboard(filter, { showStatsLoader: false, showLeadsLoader: false });
  }

  async function triggerFollowUp() {
    if (!selectedLead) {
      return;
    }

    const preview = await api<FollowUpPreview>(`/dashboard/leads/${selectedLead.id}/follow-up`, {
      method: "POST"
    });
    setFollowUpPreview(preview);
  }

  function exportSingleLead(lead: Lead) {
    const csv = [CSV_HEADERS, buildCsvRow(lead)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const safeName = (lead.name ?? "lead").replace(/[^\w-]+/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `lead-${safeName}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function renderStatusCell(lead: Lead) {
    const conversationStatus = lead.conversation?.status ?? "ACTIVE";

    return (
      <div className="flex items-center gap-2">
        {conversationStatus === "HANDOVER" ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
            style={{ background: "#2d1510", border: "1px solid rgba(232,93,74,0.3)", color: "#e85d4a" }}
          >
            ðŸ”´ Contacted
          </span>
        ) : conversationStatus === "COMPLETED" && lead.score >= 70 ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
            style={{ background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.3)", color: "#e2c98f" }}
          >
            ðŸ”¥ Hot Lead
          </span>
        ) : conversationStatus === "COMPLETED" && lead.score >= 40 ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
            style={{ background: "#2a2208", border: "1px solid rgba(202,138,4,0.3)", color: "#fbbf24" }}
          >
            ðŸŸ¡ Warm Lead
          </span>
        ) : (
          <span
            className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
            style={{ background: "#0d1a2a", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd" }}
          >
            ðŸ’¬ Active
          </span>
        )}
      </div>
    );
  }

  function renderTriggerCell(lead: Lead) {
    let label = "â€”";

    if (lead.score >= 70 && !lead.triggerType) {
      label = "ðŸ”¥ Score â‰¥70";
    } else if (lead.triggerType === "CALLBACK") {
      label = "ðŸ“ž Callback";
    } else if (lead.triggerType === "SAMPLE") {
      label = "ðŸ“‹ Sample Ask";
    } else if (lead.triggerType === "HANDOVER_REQUEST") {
      label = "ðŸ¤ Requested";
    } else if (lead.triggerType) {
      label = lead.triggerType;
    }

    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-1 text-xs"
        style={{ background: "#161616", border: "1px solid #2a2a2a", color: "#b8b0a4" }}
      >
        {label}
      </span>
    );
  }

  const visibleLeads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return leads;
    }

    return leads.filter((lead) =>
      (lead.name ?? "").toLowerCase().includes(query) ||
      (lead.productInterest ?? "").toLowerCase().includes(query) ||
      (lead.showroomCity ?? "").toLowerCase().includes(query)
    );
  }, [leads, searchTerm]);

  const showStatsSkeleton = isStatsLoading && !hasLoadedStats;
  const showLeadRowsSkeleton = isLeadsLoading && !hasLoadedLeads;

  return (
    <div className="space-y-5">
      <section
        id="stats"
        className="rounded-[24px] p-6"
        style={{ background: "#111111", border: "1px solid #1f1f1f" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
              Lead Intelligence
            </p>
            <h1
              className="mt-2 leading-tight"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "30px", fontWeight: 600, color: "#f5f0eb" }}
            >
              Hot Leads Dashboard
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "#c8a96e", animation: "livePulse 2s ease-in-out infinite" }}
              />
              <p className="text-[11px]" style={{ color: "#6b6560" }}>
                Score â‰¥ 70 Â· Auto-refreshes every 10s
              </p>
            </div>
            {(isStatsLoading || isLeadsLoading) && (hasLoadedStats || hasLoadedLeads) && (
              <p className="mt-2 text-[11px]" style={{ color: "#8f8678" }}>
                Refreshing dashboard data...
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={fileUrl("/dashboard/export.csv")}
              className="rounded-full px-4 py-2 text-sm transition-all duration-150 btn-ghost"
            >
              Export CSV
            </a>
            <button
              onClick={() => void fetchDashboard(filter, { showStatsLoader: false, showLeadsLoader: false })}
              className="rounded-full px-4 py-2 text-sm transition-all duration-150 btn-ghost"
            >
              â†» Refresh
            </button>
            <button
              onClick={loadDemo}
              className="rounded-full px-4 py-2 text-sm font-semibold btn-amber"
            >
              Load Demo
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Conversations" value={stats.totalConversations} subtitle="All sessions" isLoading={showStatsSkeleton} />
          <StatCard label="Hot Leads" value={stats.hotLeads} subtitle="Score threshold reached" isLoading={showStatsSkeleton} />
          <StatCard label="Warm Leads" value={stats.warmLeads} subtitle="In progress" isLoading={showStatsSkeleton} />
          <StatCard label="Avg Score" value={stats.avgScore} subtitle="Across all sessions" isLoading={showStatsSkeleton} />
          <StatCard label="Trigger Type" value={stats.mostCommonTrigger} subtitle="Most common" isLoading={showStatsSkeleton} />
        </div>
      </section>

      <section
        className="rounded-[24px] p-6"
        style={{ background: "#111111", border: "1px solid #1f1f1f" }}
      >
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className="rounded-full px-4 py-2 text-sm font-medium transition-all duration-150"
              style={
                filter === item.value
                  ? { background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.35)", color: "#e2c98f" }
                  : { background: "transparent", border: "1px solid #2a2a2a", color: "#b8b0a4" }
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, product, city..."
            className="w-full rounded-full px-5 py-3 text-sm transition-all duration-150"
            style={{
              background: "#161616",
              border: "1px solid #2a2a2a",
              color: "#f5f0eb"
            }}
          />
        </div>

        <div
          className="mt-5 overflow-hidden rounded-[20px]"
          style={{ border: "1px solid #1f1f1f" }}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead style={{ background: "#0f0f0f" }}>
                <tr>
                  {["Name", "Score", "Status", "Interest", "Type", "Investment", "Area (sqft)", "Timeline", "Trigger", "Last Active", "Action"].map((head) => (
                    <th
                      key={head}
                      className="px-4 py-4 font-medium"
                      style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.25em", color: "#6b6560" }}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {showLeadRowsSkeleton && Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} style={{ borderTop: "1px solid #1f1f1f" }}>
                    <td className="px-4 py-4">{skeletonBox("96px", "14px")}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 rounded-full" style={{ background: "#1f1f1f" }}>
                          <div className="h-1 w-2/3 animate-pulse rounded-full" style={{ background: "#2a2a2a" }} />
                        </div>
                        {skeletonBox("28px", "14px")}
                      </div>
                    </td>
                    <td className="px-4 py-4">{skeletonBox("72px", "24px")}</td>
                    <td className="px-4 py-4">{skeletonBox("88px", "14px")}</td>
                    <td className="px-4 py-4">{skeletonBox("72px", "14px")}</td>
                    <td className="px-4 py-4">{skeletonBox("90px", "14px")}</td>
                    <td className="px-4 py-4">{skeletonBox("56px", "14px")}</td>
                    <td className="px-4 py-4">{skeletonBox("74px", "14px")}</td>
                    <td className="px-4 py-4">{skeletonBox("82px", "24px")}</td>
                    <td className="px-4 py-4">{skeletonBox("52px", "12px")}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {skeletonBox("58px", "28px")}
                        {skeletonBox("62px", "28px")}
                      </div>
                    </td>
                  </tr>
                ))}

                {!showLeadRowsSkeleton && visibleLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    style={{ borderTop: "1px solid #1f1f1f" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <td className="px-4 py-4 text-sm font-medium" style={{ color: "#f5f0eb" }}>
                      {lead.name}
                    </td>
                    <td className="px-4 py-4">
                      <div className="group relative flex min-w-[90px] items-center gap-2">
                        <div className="h-1 flex-1 rounded-full" style={{ background: "#1f1f1f" }}>
                          <div
                            className="h-1 rounded-full"
                            style={{
                              width: `${Math.min(lead.score, 100)}%`,
                              background: lead.score >= 70
                                ? "linear-gradient(90deg, #c8a96e, #e2c98f)"
                                : lead.score >= 40
                                  ? "#fbbf24"
                                  : "#6b6560"
                            }}
                          />
                        </div>
                        <span
                          className="w-8 shrink-0 text-right font-mono text-sm font-semibold"
                          style={{ color: "#f5f0eb" }}
                        >
                          {lead.score}
                        </span>

                        <div
                          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-48 -translate-x-1/2 rounded-[14px] p-3 text-xs shadow-modal group-hover:block"
                          style={{ background: "#161616", border: "1px solid #2a2a2a" }}
                        >
                          <div className="mb-2 font-semibold" style={{ color: "#f5f0eb" }}>Score Breakdown</div>
                          <div className="space-y-1" style={{ color: "#b8b0a4" }}>
                            {[
                              ["Budget", lead.leadScore?.budget, 30],
                              ["Area", lead.leadScore?.space, 20],
                              ["Design Interest", lead.leadScore?.productInterest, 15],
                              ["Timeline", lead.leadScore?.timeline, 10],
                              ["Engagement", lead.leadScore?.engagement, 25]
                            ].map(([lbl, val, max]) => (
                              <div key={String(lbl)} className="flex justify-between">
                                <span>{lbl}</span>
                                <span style={{ color: "#e2c98f" }}>{val ?? "â€”"}/{max}</span>
                              </div>
                            ))}
                            <div
                              className="mt-1 flex justify-between border-t pt-1 font-semibold"
                              style={{ borderColor: "#2a2a2a", color: "#f5f0eb" }}
                            >
                              <span>Total</span>
                              <span>{lead.score}/100</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">{renderStatusCell(lead)}</td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#b8b0a4" }}>{lead.productInterest}</td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#b8b0a4" }}>{lead.customerType}</td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#b8b0a4" }}>{lead.investmentRange}</td>
                    <td className="px-4 py-4 font-mono text-sm" style={{ color: "#b8b0a4" }}>{lead.areaSqft ?? "-"}</td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#b8b0a4" }}>{lead.timeline}</td>
                    <td className="px-4 py-4">{renderTriggerCell(lead)}</td>
                    <td className="px-4 py-4 font-mono text-xs" style={{ color: "#6b6560" }}>{timeAgo(lead.updatedAt)}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => void openLead(lead)}
                          className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
                          style={{ border: "1px solid rgba(200,169,110,0.35)", color: "#c8a96e" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#3d2e1a"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => exportSingleLead(lead)}
                          className="rounded-full px-3 py-1.5 text-xs transition-all duration-150"
                          style={{ border: "1px solid #2a2a2a", color: "#6b6560" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#b8b0a4"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6b6560"; }}
                        >
                          Export
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!showLeadRowsSkeleton && !visibleLeads.length && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center"
                      style={{ color: "#6b6560" }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl opacity-30">â—Ž</span>
                        <span className="text-sm">No leads yet. Load the demo to see data.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <LeadModal
        lead={selectedLead}
        isLoading={isLeadDetailLoading}
        leadLabel={selectedLeadLabel}
        onClose={closeLead}
        onTriggerFollowUp={() => void triggerFollowUp()}
      />

      {followUpPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[28px] p-6"
            style={{ background: "#111111", border: "1px solid #1f1f1f", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
                  Follow-up Preview
                </p>
                <h2
                  className="mt-2 leading-tight"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f5f0eb" }}
                >
                  Generated Follow-up Layers
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFollowUpPreview(null)}
                className="rounded-full px-4 py-2 text-sm btn-ghost shrink-0"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {followUpPreview.layers.map((layer) => (
                <article
                  key={layer.layer}
                  className="rounded-[20px] p-5"
                  style={{ background: "#161616", border: "1px solid #2a2a2a" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-medium uppercase tracking-[0.28em]" style={{ color: "#6b6560" }}>
                        Layer {layer.layer}
                      </p>
                      <h3 className="mt-1.5 text-base font-semibold" style={{ color: "#f5f0eb" }}>
                        {layer.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(layer.message);
                        setCopiedLayer(layer.layer);
                        setTimeout(() => setCopiedLayer(null), 1500);
                      }}
                      className="shrink-0 rounded-full px-3 py-1 text-xs transition-all duration-150"
                      style={
                        copiedLayer === layer.layer
                          ? { background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.35)", color: "#e2c98f" }
                          : { border: "1px solid #2a2a2a", color: "#6b6560" }
                      }
                    >
                      {copiedLayer === layer.layer ? "âœ“ Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "#b8b0a4" }}>
                    {layer.message}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
