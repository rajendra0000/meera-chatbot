import { fileUrl } from "../lib/api";
import { useLocation } from "react-router-dom";
import { ReactNode, useState } from "react";

const navSections = [
  {
    label: "CHAT",
    items: [{ to: "/", label: "Meera Chat" }]
  },
  {
    label: "INTELLIGENCE",
    items: [
      { to: "/dashboard", label: "Hot Leads" },
      { to: "/dashboard?tab=all", label: "All Conversations" },
      { to: "/dashboard#stats", label: "Analytics" }
    ]
  },
  {
    label: "SYSTEM",
    items: [{ to: "/admin/sandbox", label: "Admin Sandbox" }]
  }
];

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function isActive(to: string) {
    if (to.startsWith("/dashboard")) {
      return location.pathname === "/dashboard" && to === "/dashboard";
    }
    return location.pathname === to;
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* ── Logo ─────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-mono text-sm font-bold"
            style={{
              background: "#3d2e1a",
              borderColor: "rgba(200,169,110,0.3)",
              color: "#c8a96e"
            }}
          >
            HC
          </div>
          <div>
            <p
              className="text-[9px] font-medium uppercase tracking-[0.35em]"
              style={{ color: "#c8a96e" }}
            >
              Hey Concrete
            </p>
            <p className="text-sm font-medium" style={{ color: "#f5f0eb" }}>
              Meera OS
            </p>
          </div>
        </div>
        <p
          className="mt-3 text-[10px] italic leading-relaxed"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#6b6560" }}
        >
          Walls that scream RAWyalty
        </p>
      </div>

      {/* ── Navigation ───────────────────────────── */}
      <nav className="flex-1 space-y-1">
        {navSections.map((section) => (
          <div key={section.label}>
            <p
              className="mb-1 px-1 text-[9px] font-medium uppercase tracking-[0.35em]"
              style={{ color: "#6b6560" }}
            >
              {section.label}
            </p>
            {section.items.map((item) => {
              const active = isActive(item.to);
              return (
                <a
                  key={item.to}
                  href={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className="relative mb-0.5 flex items-center rounded-xl px-4 py-2.5 text-sm transition-all duration-150"
                  style={
                    active
                      ? {
                          background: "#3d2e1a",
                          color: "#e2c98f",
                          borderLeft: "2px solid #c8a96e",
                          paddingLeft: "14px"
                        }
                      : {
                          color: "#b8b0a4",
                          borderLeft: "2px solid transparent"
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "#1f1f1f";
                      (e.currentTarget as HTMLElement).style.color = "#f5f0eb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "";
                      (e.currentTarget as HTMLElement).style.color = "#b8b0a4";
                    }
                  }}
                >
                  {item.label}
                </a>
              );
            })}
            <div className="mt-4" />
          </div>
        ))}

        {/* Export CSV as standalone link */}
        <a
          href={fileUrl("/dashboard/export.csv")}
          className="mb-0.5 flex items-center rounded-xl px-4 py-2.5 text-sm transition-all duration-150"
          style={{ color: "#b8b0a4", borderLeft: "2px solid transparent" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#1f1f1f";
            (e.currentTarget as HTMLElement).style.color = "#f5f0eb";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "";
            (e.currentTarget as HTMLElement).style.color = "#b8b0a4";
          }}
        >
          Export CSV
        </a>
      </nav>

      {/* ── Bottom status ────────────────────────── */}
      <div
        className="mt-auto border-t pt-4"
        style={{ borderColor: "#1f1f1f" }}
      >
        <span className="flex items-center gap-2 text-[11px]" style={{ color: "#6b6560" }}>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "#4ade80", animation: "livePulse 2s ease-in-out infinite" }}
          />
          Live — synced with chatbot
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* ── Mobile top bar ──────────────────────── */}
      <header
        className="flex items-center justify-between px-4 py-3 md:hidden"
        style={{ background: "#111111", borderBottom: "1px solid #1f1f1f" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold"
            style={{ background: "#3d2e1a", color: "#c8a96e" }}
          >
            HC
          </div>
          <span className="text-sm font-medium" style={{ color: "#f5f0eb" }}>
            Meera OS
          </span>
        </div>
        <button
          onClick={() => setMobileNavOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition"
          style={{ color: "#b8b0a4", background: "#1f1f1f" }}
          aria-label="Toggle navigation"
        >
          {mobileNavOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* ── Mobile nav overlay ──────────────────── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <aside
            className="h-full w-72 p-5"
            style={{ background: "#111111", borderRight: "1px solid #1f1f1f" }}
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ── Desktop layout ──────────────────────── */}
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 md:items-start md:px-6">
        <aside
          className="hidden w-[272px] shrink-0 self-start rounded-[24px] p-5 md:sticky md:top-4 md:flex md:h-[calc(100vh-2rem)] md:flex-col md:overflow-y-auto"
          style={{ background: "#111111", border: "1px solid #1f1f1f" }}
        >
          {sidebarContent}
        </aside>
        <main className="min-w-0 flex-1 py-2">{children}</main>
      </div>
    </div>
  );
}
