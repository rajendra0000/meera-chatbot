import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { ChatResponse, PromptVersion } from "../types";
import { ChatBubble } from "../components/ChatBubble";
import { QuickReplies } from "../components/QuickReplies";

type SandboxMessage = {
  role: "USER" | "ASSISTANT";
  content: string;
  promptVersionLabel?: string | null;
};

type TabId = "sandbox" | "knowledge" | "locations" | "system" | "learning";

type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string;
  createdAt: string;
};

type ShowroomLocation = {
  id: string;
  name: string;
  city: string;
  address: string;
  contact: string | null;
};

type FaqFormState = {
  question: string;
  answer: string;
  category: string;
  keywords: string;
};

type LocationFormState = {
  city: string;
  name: string;
  address: string;
  contact: string;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "sandbox", label: "Sandbox" },
  { id: "knowledge", label: "Knowledge Base" },
  { id: "locations", label: "Locations" },
  { id: "system", label: "System Prompt" },
  { id: "learning", label: "Learning Prompt" }
];

const faqCategories = [
  "Company",
  "Products",
  "Installation",
  "Sustainability",
  "Pricing",
  "Locations",
  "Customization",
  "General"
];

const emptyFaqForm: FaqFormState = {
  question: "",
  answer: "",
  category: "General",
  keywords: ""
};

const emptyLocationForm: LocationFormState = {
  city: "",
  name: "",
  address: "",
  contact: ""
};

function truncate(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export function AdminSandboxPage() {
  const [activeTab, setActiveTab] = useState<TabId>("sandbox");
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<SandboxMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [isSandboxLoading, setIsSandboxLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [correction, setCorrection] = useState("Instead of saying \"Sure\", say \"Kyo nahi\".");
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [isVersionsLoading, setIsVersionsLoading] = useState(true);
  const [hasLoadedVersions, setHasLoadedVersions] = useState(false);
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>([]);
  const [isFaqLoading, setIsFaqLoading] = useState(false);
  const [hasLoadedFaq, setHasLoadedFaq] = useState(false);
  const [locations, setLocations] = useState<ShowroomLocation[]>([]);
  const [isLocationsLoading, setIsLocationsLoading] = useState(false);
  const [hasLoadedLocations, setHasLoadedLocations] = useState(false);
  const [faqForm, setFaqForm] = useState<FaqFormState>(emptyFaqForm);
  const [locationForm, setLocationForm] = useState<LocationFormState>(emptyLocationForm);
  const [faqEditorId, setFaqEditorId] = useState<string | null>(null);
  const [locationEditorId, setLocationEditorId] = useState<string | null>(null);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);

  useEffect(() => {
    void bootstrap();
    void loadVersions();
  }, []);

  useEffect(() => {
    if (activeTab === "knowledge") {
      void loadFaqEntries();
    }
    if (activeTab === "locations") {
      void loadLocations();
    }
  }, [activeTab]);

  const learningVersions = useMemo(
    () => versions.filter((item) => item.type === "LEARNING"),
    [versions]
  );

  const activeSystemPrompt = useMemo(
    () => versions.find((item) => item.type === "SYSTEM" && item.isActive)?.content ?? "No active system prompt found.",
    [versions]
  );

  function toAssistantMessage(response: ChatResponse): SandboxMessage {
    return {
      role: "ASSISTANT",
      content: response.replyText,
      promptVersionLabel: response.promptVersionLabel
    };
  }

  async function bootstrap() {
    setIsSandboxLoading(true);
    try {
      const response = await api<ChatResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({ bootstrap: true, channel: "SANDBOX" })
      });

      setConversationId(response.conversationId);
      setMessages([toAssistantMessage(response)]);
      setQuickReplies(response.quickReplies);
    } finally {
      setIsSandboxLoading(false);
    }
  }

  async function loadVersions(showLoader = !hasLoadedVersions) {
    if (showLoader) {
      setIsVersionsLoading(true);
    }

    try {
      const response = await api<PromptVersion[]>("/admin/prompt-versions");
      setVersions(response);
      setHasLoadedVersions(true);
    } finally {
      setIsVersionsLoading(false);
    }
  }

  async function loadFaqEntries(showLoader = !hasLoadedFaq) {
    if (showLoader) {
      setIsFaqLoading(true);
    }

    try {
      setFaqEntries(await api<FaqEntry[]>("/admin/faq"));
      setHasLoadedFaq(true);
    } finally {
      setIsFaqLoading(false);
    }
  }

  async function loadLocations(showLoader = !hasLoadedLocations) {
    if (showLoader) {
      setIsLocationsLoading(true);
    }

    try {
      setLocations(await api<ShowroomLocation[]>("/admin/locations"));
      setHasLoadedLocations(true);
    } finally {
      setIsLocationsLoading(false);
    }
  }

  async function send(text: string) {
    if (!text.trim() || isSending || isSandboxLoading) {
      return;
    }

    setMessages((current) => [...current, { role: "USER", content: text }]);
    setDraft("");
    setIsSending(true);

    try {
      const response = await api<ChatResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({ conversationId, message: text, channel: "SANDBOX" })
      });

      setMessages((current) => [...current, toAssistantMessage(response)]);
      setQuickReplies(response.quickReplies);
    } finally {
      setIsSending(false);
    }
  }

  async function startNewChat() {
    setConversationId("");
    setMessages([]);
    setQuickReplies([]);
    setDraft("");
    await bootstrap();
  }

  async function saveCorrection(event: FormEvent) {
    event.preventDefault();
    await api("/admin/prompt-versions/learning", {
      method: "POST",
      body: JSON.stringify({ content: correction })
    });
    await loadVersions();
  }

  async function rollback(id: number) {
    await api(`/admin/prompt-versions/${id}/rollback`, { method: "POST" });
    await loadVersions();
  }

  function beginAddFaq() {
    setFaqEditorId(null);
    setFaqForm(emptyFaqForm);
    setShowFaqForm(true);
  }

  function beginEditFaq(entry: FaqEntry) {
    setFaqEditorId(entry.id);
    setFaqForm({
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
      keywords: entry.keywords
    });
    setShowFaqForm(true);
  }

  function cancelFaqForm() {
    setFaqEditorId(null);
    setFaqForm(emptyFaqForm);
    setShowFaqForm(false);
  }

  async function submitFaq(event: FormEvent) {
    event.preventDefault();
    const path = faqEditorId ? `/admin/faq/${faqEditorId}` : "/admin/faq";
    const method = faqEditorId ? "PUT" : "POST";

    await api(path, {
      method,
      body: JSON.stringify(faqForm)
    });

    cancelFaqForm();
    await loadFaqEntries();
  }

  async function removeFaq(id: string) {
    if (!window.confirm("Delete this FAQ entry?")) {
      return;
    }

    await api(`/admin/faq/${id}`, { method: "DELETE" });
    await loadFaqEntries();
  }

  function beginAddLocation() {
    setLocationEditorId(null);
    setLocationForm(emptyLocationForm);
    setShowLocationForm(true);
  }

  function beginEditLocation(location: ShowroomLocation) {
    setLocationEditorId(location.id);
    setLocationForm({
      city: location.city,
      name: location.name,
      address: location.address,
      contact: location.contact ?? ""
    });
    setShowLocationForm(true);
  }

  function cancelLocationForm() {
    setLocationEditorId(null);
    setLocationForm(emptyLocationForm);
    setShowLocationForm(false);
  }

  async function submitLocation(event: FormEvent) {
    event.preventDefault();
    const path = locationEditorId ? `/admin/locations/${locationEditorId}` : "/admin/locations";
    const method = locationEditorId ? "PUT" : "POST";

    await api(path, {
      method,
      body: JSON.stringify(locationForm)
    });

    cancelLocationForm();
    await loadLocations();
  }

  async function removeLocation(id: string) {
    if (!window.confirm("Delete this showroom location?")) {
      return;
    }

    await api(`/admin/locations/${id}`, { method: "DELETE" });
    await loadLocations();
  }

  /* ── Shared style constants ──────────────────────────── */
  const inputStyle = {
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    color: "#f5f0eb",
    fontFamily: "inherit"
  };

  const tableEmptyState = (cols: number, message: string) => (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl opacity-20">◎</span>
          <span className="text-sm" style={{ color: "#6b6560" }}>{message}</span>
        </div>
      </td>
    </tr>
  );

  const skeletonLine = (width: string, height = "12px") => (
    <div
      className="animate-pulse rounded-full"
      style={{ width, height, background: "#1a1a1a", border: "1px solid #242424" }}
    />
  );

  const tableLoadingState = (cols: number) => (
    <>
      {Array.from({ length: 4 }).map((_, rowIndex) => (
        <tr key={`loading-${cols}-${rowIndex}`} style={{ borderTop: "1px solid #1f1f1f" }}>
          {Array.from({ length: cols }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-4">
              {skeletonLine(colIndex === cols - 1 ? "92px" : colIndex === 0 ? "120px" : "80px", colIndex === cols - 1 ? "28px" : "14px")}
            </td>
          ))}
        </tr>
      ))}
    </>
  );

  return (
    <div className="space-y-5">
      {/* ── Tab Bar ──────────────────────────────────── */}
      <section
        className="rounded-[24px] p-4"
        style={{ background: "#111111", border: "1px solid #1f1f1f" }}
      >
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="rounded-full px-4 py-2 text-sm font-medium transition-all duration-150"
              style={
                activeTab === tab.id
                  ? { background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.35)", color: "#e2c98f" }
                  : { background: "transparent", border: "1px solid #2a2a2a", color: "#b8b0a4" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ══════════════════ SANDBOX TAB ══════════════════ */}
      {activeTab === "sandbox" && (
        <section
          className="rounded-[24px] p-6"
          style={{ background: "#111111", border: "1px solid #1f1f1f" }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
                Live Sandbox
              </p>
              <h1
                className="mt-2 leading-tight"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f5f0eb" }}
              >
                Meera Chat
              </h1>
              {(isSandboxLoading || isSending) && (
                <p className="mt-2 text-[11px]" style={{ color: "#8f8678" }}>
                  {isSandboxLoading ? "Loading sandbox..." : "Meera is replying..."}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-medium"
                style={{ background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.25)", color: "#e2c98f" }}
              >
                Prompt-Aware
              </span>
              <button
                type="button"
                onClick={() => void startNewChat()}
                className="rounded-full px-4 py-2 text-xs transition-all duration-150 btn-ghost"
                disabled={isSandboxLoading || isSending}
              >
                New Chat
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {isSandboxLoading && !messages.length && (
              <>
                {[64, 56, 70].map((width, index) => (
                  <div key={index} className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <div
                      className="h-12 animate-pulse rounded-[20px]"
                      style={{
                        width: `${width}%`,
                        background: index % 2 === 0 ? "#1f1f1f" : "rgba(200,169,110,0.08)",
                        border: "1px solid #2a2a2a"
                      }}
                    />
                  </div>
                ))}
              </>
            )}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className="space-y-2">
                <ChatBubble role={message.role} content={message.content} />
                {message.role === "ASSISTANT" && message.promptVersionLabel && (
                  <div className="flex justify-start pl-8">
                    <span
                      className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] font-mono"
                      style={{ background: "#161616", border: "1px solid #2a2a2a", color: "#6b6560" }}
                    >
                      {message.promptVersionLabel}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div
                  className="h-12 w-[62%] animate-pulse rounded-[20px]"
                  style={{ background: "#1f1f1f", border: "1px solid #2a2a2a" }}
                />
              </div>
            )}
            <QuickReplies replies={isSandboxLoading ? [] : quickReplies} onSelect={(value) => void send(value)} />
          </div>

          <form
            onSubmit={(event) => { event.preventDefault(); void send(draft); }}
            className="mt-6 flex gap-3"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="flex-1 rounded-full px-5 py-3 text-sm transition-all duration-150"
              style={inputStyle}
              placeholder="Test a sandbox message..."
              disabled={isSandboxLoading || isSending}
            />
            <button
              type="submit"
              className="rounded-full px-5 py-3 text-sm font-semibold btn-amber"
              disabled={isSandboxLoading || isSending}
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </form>
        </section>
      )}

      {/* ════════════════ KNOWLEDGE BASE TAB ════════════ */}
      {activeTab === "knowledge" && (
        <section
          className="rounded-[24px] p-6"
          style={{ background: "#111111", border: "1px solid #1f1f1f" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
                Admin Knowledge Base
              </p>
              <h2
                className="mt-2 leading-tight"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f5f0eb" }}
              >
                FAQ Entries
              </h2>
              {isFaqLoading && hasLoadedFaq && (
                <p className="mt-2 text-[11px]" style={{ color: "#8f8678" }}>
                  Updating FAQ entries...
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={beginAddFaq}
              className="rounded-full px-4 py-2 text-sm font-semibold btn-amber shrink-0"
            >
              Add Entry
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-[20px]" style={{ border: "1px solid #1f1f1f" }}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead style={{ background: "#0f0f0f" }}>
                  <tr>
                    {["Question", "Answer", "Category", "Keywords", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-4 font-medium" style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.25em", color: "#6b6560" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isFaqLoading && !hasLoadedFaq && tableLoadingState(5)}
                  {faqEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      style={{ borderTop: "1px solid #1f1f1f" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                    >
                      <td className="px-4 py-4 text-sm" style={{ color: "#f5f0eb" }}>{truncate(entry.question)}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: "#b8b0a4" }}>{truncate(entry.answer)}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: "#b8b0a4" }}>{entry.category}</td>
                      <td className="px-4 py-4 text-xs font-mono" style={{ color: "#6b6560" }}>{entry.keywords}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => beginEditFaq(entry)}
                            className="rounded-full px-3 py-1 text-xs transition-all duration-150"
                            style={{ border: "1px solid rgba(200,169,110,0.35)", color: "#c8a96e" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#3d2e1a"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeFaq(entry.id)}
                            className="rounded-full px-3 py-1 text-xs transition-all duration-150"
                            style={{ border: "1px solid rgba(232,93,74,0.3)", color: "#e85d4a" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#2d1510"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isFaqLoading && !faqEntries.length && tableEmptyState(5, "No FAQ entries yet. Add the first one.")}
                </tbody>
              </table>
            </div>
          </div>

          {showFaqForm && (
            <form
              onSubmit={(event) => void submitFaq(event)}
              className="mt-5 space-y-4 rounded-[20px] p-5"
              style={{ background: "#161616", border: "1px solid #1f1f1f" }}
            >
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-widest" style={{ color: "#6b6560" }}>Question</label>
                <textarea
                  value={faqForm.question}
                  onChange={(event) => setFaqForm((current) => ({ ...current, question: event.target.value }))}
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={inputStyle}
                  placeholder="Enter the FAQ question..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-widest" style={{ color: "#6b6560" }}>Answer</label>
                <textarea
                  value={faqForm.answer}
                  onChange={(event) => setFaqForm((current) => ({ ...current, answer: event.target.value }))}
                  rows={5}
                  className="w-full rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={inputStyle}
                  placeholder="Enter the answer..."
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-widest" style={{ color: "#6b6560" }}>Category</label>
                  <select
                    value={faqForm.category}
                    onChange={(event) => setFaqForm((current) => ({ ...current, category: event.target.value }))}
                    className="w-full rounded-full px-4 py-3 text-sm"
                    style={inputStyle}
                  >
                    {faqCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-widest" style={{ color: "#6b6560" }}>Keywords</label>
                  <input
                    value={faqForm.keywords}
                    onChange={(event) => setFaqForm((current) => ({ ...current, keywords: event.target.value }))}
                    className="w-full rounded-full px-4 py-3 text-sm"
                    style={inputStyle}
                    placeholder="comma, separated, keywords"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="rounded-full px-5 py-3 text-sm font-semibold btn-amber">
                  {faqEditorId ? "Update Entry" : "Create Entry"}
                </button>
                <button type="button" onClick={cancelFaqForm} className="rounded-full px-5 py-3 text-sm btn-ghost">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* ══════════════════ LOCATIONS TAB ════════════════ */}
      {activeTab === "locations" && (
        <section
          className="rounded-[24px] p-6"
          style={{ background: "#111111", border: "1px solid #1f1f1f" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
                Showroom Directory
              </p>
              <h2
                className="mt-2 leading-tight"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f5f0eb" }}
              >
                Locations
              </h2>
              {isLocationsLoading && hasLoadedLocations && (
                <p className="mt-2 text-[11px]" style={{ color: "#8f8678" }}>
                  Updating locations...
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={beginAddLocation}
              className="rounded-full px-4 py-2 text-sm font-semibold btn-amber shrink-0"
            >
              Add Location
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-[20px]" style={{ border: "1px solid #1f1f1f" }}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead style={{ background: "#0f0f0f" }}>
                  <tr>
                    {["City", "Partner Name", "Address", "Contact", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-4 font-medium" style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.25em", color: "#6b6560" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLocationsLoading && !hasLoadedLocations && tableLoadingState(5)}
                  {locations.map((location) => (
                    <tr
                      key={location.id}
                      style={{ borderTop: "1px solid #1f1f1f" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                    >
                      <td className="px-4 py-4 text-sm font-medium" style={{ color: "#f5f0eb" }}>{location.city}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: "#b8b0a4" }}>{location.name}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: "#b8b0a4" }}>{truncate(location.address)}</td>
                      <td className="px-4 py-4 font-mono text-xs" style={{ color: "#6b6560" }}>{location.contact ?? "-"}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => beginEditLocation(location)}
                            className="rounded-full px-3 py-1 text-xs transition-all duration-150"
                            style={{ border: "1px solid rgba(200,169,110,0.35)", color: "#c8a96e" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#3d2e1a"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeLocation(location.id)}
                            className="rounded-full px-3 py-1 text-xs transition-all duration-150"
                            style={{ border: "1px solid rgba(232,93,74,0.3)", color: "#e85d4a" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#2d1510"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLocationsLoading && !locations.length && tableEmptyState(5, "No showroom locations yet. Add the first one.")}
                </tbody>
              </table>
            </div>
          </div>

          {showLocationForm && (
            <form
              onSubmit={(event) => void submitLocation(event)}
              className="mt-5 space-y-4 rounded-[20px] p-5"
              style={{ background: "#161616", border: "1px solid #1f1f1f" }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-widest" style={{ color: "#6b6560" }}>City</label>
                  <input
                    value={locationForm.city}
                    onChange={(event) => setLocationForm((current) => ({ ...current, city: event.target.value }))}
                    className="w-full rounded-full px-4 py-3 text-sm"
                    style={inputStyle}
                    placeholder="e.g. Mumbai"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-widest" style={{ color: "#6b6560" }}>Partner Name</label>
                  <input
                    value={locationForm.name}
                    onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-full px-4 py-3 text-sm"
                    style={inputStyle}
                    placeholder="Showroom / partner name"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-widest" style={{ color: "#6b6560" }}>Address</label>
                <input
                  value={locationForm.address}
                  onChange={(event) => setLocationForm((current) => ({ ...current, address: event.target.value }))}
                  className="w-full rounded-full px-4 py-3 text-sm"
                  style={inputStyle}
                  placeholder="Full address"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-widest" style={{ color: "#6b6560" }}>Contact</label>
                <input
                  value={locationForm.contact}
                  onChange={(event) => setLocationForm((current) => ({ ...current, contact: event.target.value }))}
                  className="w-full rounded-full px-4 py-3 text-sm"
                  style={inputStyle}
                  placeholder="Phone or email"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="rounded-full px-5 py-3 text-sm font-semibold btn-amber">
                  {locationEditorId ? "Update Location" : "Create Location"}
                </button>
                <button type="button" onClick={cancelLocationForm} className="rounded-full px-5 py-3 text-sm btn-ghost">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* ═════════════════ SYSTEM PROMPT TAB ════════════ */}
      {activeTab === "system" && (
        <section
          className="rounded-[24px] p-6"
          style={{ background: "#111111", border: "1px solid #1f1f1f" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
                Prompt Reference
              </p>
              <h2
                className="mt-2 leading-tight"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f5f0eb" }}
              >
                Active System Prompt
              </h2>
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium"
              style={{ background: "#2d1510", border: "1px solid rgba(232,93,74,0.25)", color: "#e85d4a" }}
            >
              🔒 Read-only
            </span>
          </div>
          {isVersionsLoading && !hasLoadedVersions ? (
            <div
              className="mt-6 space-y-3 rounded-[20px] p-5 animate-pulse"
              style={{ background: "#0d0d0d", border: "1px solid #1f1f1f" }}
            >
              {Array.from({ length: 14 }).map((_, index) => (
                <div
                  key={`system-skeleton-${index}`}
                  style={{
                    width: index % 4 === 0 ? "72%" : index % 3 === 0 ? "94%" : "100%",
                    height: "12px",
                    borderRadius: "999px",
                    background: "#1a1a1a"
                  }}
                />
              ))}
            </div>
          ) : (
            <textarea
              value={activeSystemPrompt}
              readOnly
              rows={20}
              className="mt-6 w-full rounded-[20px] px-5 py-4 font-mono text-sm leading-relaxed"
              style={{
                background: "#0d0d0d",
                border: "1px solid #1f1f1f",
                color: "#b8b0a4",
                resize: "vertical",
                fontFamily: "'JetBrains Mono', 'Courier New', monospace"
              }}
            />
          )}
        </section>
      )}

      {/* ════════════════ LEARNING PROMPT TAB ═══════════ */}
      {activeTab === "learning" && (
        <section
          className="rounded-[24px] p-6"
          style={{ background: "#111111", border: "1px solid #1f1f1f" }}
        >
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
              Correct Meera
            </p>
            <h2
              className="mt-2 leading-tight"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f5f0eb" }}
            >
              Learning Prompt Control
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#b8b0a4" }}>
              New corrections append to the active learning prompt. They do not replace earlier rules.
            </p>
          </div>

          <form
            onSubmit={saveCorrection}
            className="mt-6 space-y-4 rounded-[20px] p-5"
            style={{ background: "#161616", border: "1px solid #1f1f1f" }}
          >
            <label className="block text-[10px] uppercase tracking-widest" style={{ color: "#6b6560" }}>
              Correction instruction
            </label>
            <textarea
              value={correction}
              onChange={(event) => setCorrection(event.target.value)}
              rows={6}
              className="w-full rounded-xl px-4 py-3 font-mono text-sm leading-relaxed"
              style={{
                background: "#1c1c1c",
                border: "1px solid #2a2a2a",
                color: "#f5f0eb",
                fontFamily: "'JetBrains Mono', 'Courier New', monospace"
              }}
            />
            <button type="submit" className="rounded-full px-5 py-3 text-sm font-semibold btn-amber">
              Append New Learning Rule
            </button>
          </form>

          <div className="mt-6">
            <h3 className="text-base font-semibold" style={{ color: "#f5f0eb" }}>
              Version History
            </h3>
            {isVersionsLoading && hasLoadedVersions && (
              <p className="mt-2 text-[11px]" style={{ color: "#8f8678" }}>
                Updating prompt versions...
              </p>
            )}
            <div className="mt-4 space-y-3">
              {isVersionsLoading && !hasLoadedVersions &&
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`version-skeleton-${index}`}
                    className="rounded-[18px] p-4 animate-pulse"
                    style={{ background: "#161616", border: "1px solid #1f1f1f" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {skeletonLine("52px", "14px")}
                        {skeletonLine("56px", "20px")}
                      </div>
                      {skeletonLine("132px", "32px")}
                    </div>
                    <div className="mt-3 space-y-2">
                      {skeletonLine("100%")}
                      {skeletonLine("92%")}
                      {skeletonLine("76%")}
                    </div>
                  </div>
                ))}
              {learningVersions.map((version) => (
                <div
                  key={version.id}
                  className="rounded-[18px] p-4 transition-all duration-150"
                  style={
                    version.isActive
                      ? { background: "#161616", border: "1px solid #1f1f1f", borderLeft: "2px solid #c8a96e", paddingLeft: "15px" }
                      : { background: "#161616", border: "1px solid #1f1f1f" }
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-sm font-medium" style={{ color: "#f5f0eb" }}>
                        v{version.versionNumber}
                      </p>
                      {version.isActive ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.3)", color: "#e2c98f" }}
                        >
                          Active
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "#6b6560" }}>Inactive</span>
                      )}
                    </div>
                    <button
                      onClick={() => void rollback(version.id)}
                      className="rounded-full px-4 py-1.5 text-xs transition-all duration-150 btn-ghost"
                    >
                      Rollback to v{version.versionNumber}
                    </button>
                  </div>
                  <p className="mt-3 font-mono text-xs leading-relaxed" style={{ color: "#b8b0a4", fontFamily: "'JetBrains Mono', monospace" }}>
                    {version.content}
                  </p>
                </div>
              ))}
              {!isVersionsLoading && !learningVersions.length && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <span className="text-2xl opacity-20">◎</span>
                  <span className="text-sm" style={{ color: "#6b6560" }}>No learning versions yet.</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
