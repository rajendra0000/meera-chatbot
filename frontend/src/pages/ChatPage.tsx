import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { ChatResponse, HistoryResponse, Product } from "../types";
import { ChatBubble } from "../components/ChatBubble";
import { ProductCarousel } from "../components/ProductCarousel";
import { QuickReplies } from "../components/QuickReplies";

const STORAGE_KEY = "meera_conversation_id";

type ChatEntry =
  | { id: string; type: "message"; role: "USER" | "ASSISTANT"; content: string }
  | { id: string; type: "carousel"; products: Product[]; renderKey: string; isMoreImages: boolean };

function normalizeProduct(product: Product): Product {
  let parsedImageUrls: string[] = [];

  if (Array.isArray(product.imageUrls)) {
    parsedImageUrls = product.imageUrls;
  } else if (typeof product.imageUrls === "string") {
    try {
      parsedImageUrls = JSON.parse(product.imageUrls || "[]") as string[];
    } catch {
      parsedImageUrls = [];
    }
  } else {
    parsedImageUrls = product.image_urls ?? [];
  }

  const galleryImages = product.galleryImages ?? product.gallery_images ?? parsedImageUrls;
  const shadeImages = product.shadeImages ?? product.shade_images ?? [];
  const thumbnailUrl =
    product.thumbnailUrl ??
    product.thumbnail_url ??
    product.imageUrl ??
    product.image_url ??
    galleryImages[0] ??
    "";

  return {
    ...product,
    priceRange: product.priceRange ?? product.price_range ?? "",
    imageUrl: thumbnailUrl,
    image_url: thumbnailUrl,
    thumbnailUrl,
    thumbnail_url: thumbnailUrl,
    bestFor: product.bestFor ?? product.best_for ?? "",
    imageUrls: galleryImages,
    image_urls: galleryImages,
    galleryImages,
    gallery_images: galleryImages,
    shadeImages,
    shade_images: shadeImages,
  };
}

function createMessageEntry(role: "USER" | "ASSISTANT", content: string): ChatEntry {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "message",
    role,
    content
  };
}

function createCarouselEntry(products: Product[], isMoreImages: boolean): ChatEntry {
  return {
    id: `carousel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "carousel",
    products,
    renderKey: JSON.stringify([isMoreImages, ...products.map((product) => product.id)]),
    isMoreImages
  };
}

export function ChatPage() {
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [isPostComplete, setIsPostComplete] = useState(false);
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
      void restoreHistory(savedId);
    } else {
      void bootstrap();
    }
  }, []);

  async function restoreHistory(savedId: string) {
    try {
      const history = await api<HistoryResponse>(`/chat/conversation/${savedId}/messages`);
      if (history.messages.length === 0) {
        void bootstrap();
        return;
      }

      setConversationId(savedId);
      setMessages(
        history.messages.map((message) => createMessageEntry(message.role, message.content))
      );

      if (history.step === "COMPLETED") {
        setIsPostComplete(true);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      void bootstrap();
    }
  }

  async function bootstrap() {
    const response = await api<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ bootstrap: true })
    });

    localStorage.setItem(STORAGE_KEY, response.conversationId);
    setConversationId(response.conversationId);
    setMessages([createMessageEntry("ASSISTANT", response.replyText)]);
    setQuickReplies(response.quickReplies);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || sending) {
      return;
    }

    setMessages((current) => [...current, createMessageEntry("USER", text)]);
    setDraft("");
    setSending(true);

    try {
      const response = await api<ChatResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({ conversationId, message: text })
      });

      const assistantEntry = createMessageEntry("ASSISTANT", response.replyText);
      const nextProducts = (response.recommend_products ?? response.recommendProducts ?? []).map(normalizeProduct);

      setMessages((current) => {
        const nextEntries = [...current, assistantEntry];
        if (nextProducts.length > 0) {
          nextEntries.push(createCarouselEntry(nextProducts, Boolean(response.isMoreImages)));
        }
        return nextEntries;
      });

      setQuickReplies(response.quickReplies);

      if (response.nextStep === "COMPLETED") {
        setIsPostComplete(true);
      }
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(draft);
  }

  async function startNewChat() {
    localStorage.removeItem(STORAGE_KEY);
    setConversationId("");
    setMessages([]);
    setQuickReplies([]);
    setIsPostComplete(false);
    setShowNewChatConfirm(false);
    await bootstrap();
  }

  return (
    <div className="grid min-h-[calc(100vh-5rem)] gap-5 lg:grid-cols-[300px,1fr]">
      {/* ── Left: Brand / Info Panel ─────────────────── */}
      <section
        className="flex flex-col rounded-[24px] p-6"
        style={{ background: "#111111", border: "1px solid #1f1f1f" }}
      >
        {/* Amber accent strip */}
        <div
          className="mb-5 h-[3px] w-14 rounded-full"
          style={{ background: "linear-gradient(90deg, #c8a96e, #e2c98f)" }}
        />

        <p className="text-[9px] font-medium uppercase tracking-[0.35em]" style={{ color: "#6b6560" }}>
          Meet Meera
        </p>
        <h2
          className="mt-2 leading-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "26px", fontWeight: 600, color: "#f5f0eb" }}
        >
          Your Hey Concrete
        </h2>
        <p
          className="mb-4 leading-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "18px", fontStyle: "italic", color: "#c8a96e" }}
        >
          Design Consultant
        </p>

        <p className="text-[13px] leading-relaxed" style={{ color: "#b8b0a4" }}>
          Meera helps architects, interior designers, and homeowners find the perfect wall panels, breeze blocks, and murals for their projects.
        </p>

        <div className="my-5" style={{ borderTop: "1px solid #1f1f1f" }} />

        <div className="space-y-3">
          {[
            "Product recommendations",
            "Budget & space planning",
            "Showroom & sample requests"
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: "#c8a96e" }}
              />
              <span className="text-[13px]" style={{ color: "#f5f0eb" }}>
                {feature}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-6">
          {isPostComplete ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
              style={{ background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.2)", color: "#e2c98f" }}
            >
              ✦ Free consultation mode
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
              style={{ background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.2)", color: "#e2c98f" }}
            >
              ✦ Free consultation
            </span>
          )}
        </div>
      </section>

      {/* ── Right: Chat Interface ─────────────────────── */}
      <section
        className="flex min-h-[80vh] flex-col rounded-[24px]"
        style={{ background: "#0f0f0f", border: "1px solid #1f1f1f" }}
      >
        {/* Chat header */}
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #1f1f1f" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm font-bold"
              style={{ background: "#3d2e1a", color: "#c8a96e" }}
            >
              M
            </div>
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "#f5f0eb" }}>
                Meera
              </p>
              <p className="text-[11px]" style={{ color: "#6b6560" }}>
                Hey Concrete consultant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-[11px] font-medium"
              style={{ background: "#3d2e1a", border: "1px solid rgba(200,169,110,0.25)", color: "#e2c98f" }}
            >
              ● Live
            </span>
            <button
              onClick={() => setShowNewChatConfirm(true)}
              className="rounded-full px-3 py-1.5 text-xs transition-all duration-150"
              style={{ border: "1px solid #2a2a2a", color: "#6b6560" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,169,110,0.4)";
                (e.currentTarget as HTMLElement).style.color = "#f5f0eb";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#2a2a2a";
                (e.currentTarget as HTMLElement).style.color = "#6b6560";
              }}
            >
              + New Chat
            </button>
          </div>
        </header>

        {/* New chat confirm banner */}
        {showNewChatConfirm && (
          <div
            className="mx-5 mt-3 flex items-center justify-between rounded-[14px] px-4 py-3 text-sm animate-fade-up"
            style={{ background: "#161616", border: "1px solid #2a2a2a" }}
          >
            <span style={{ color: "#b8b0a4" }}>Start a new conversation? Current chat will end.</span>
            <div className="flex gap-2">
              <button
                onClick={() => void startNewChat()}
                className="rounded-full px-4 py-1.5 text-xs font-semibold btn-amber"
              >
                Yes, start fresh
              </button>
              <button
                onClick={() => setShowNewChatConfirm(false)}
                className="rounded-full px-4 py-1.5 text-xs btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4">
            {messages.map((entry) =>
              entry.type === "message" ? (
                <ChatBubble key={entry.id} role={entry.role} content={entry.content} />
              ) : (
                <ProductCarousel
                  key={entry.renderKey}
                  products={entry.products}
                  isMoreImages={entry.isMoreImages}
                />
              )
            )}

            {/* Typing indicator while sending */}
            {sending && (
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-2 rounded-[20px_20px_20px_4px] px-4 py-3"
                  style={{ background: "#161616", border: "1px solid #2a2a2a", borderLeft: "2px solid rgba(200,169,110,0.25)" }}
                >
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <QuickReplies replies={quickReplies} onSelect={(value) => void sendMessage(value)} />
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <form
          onSubmit={onSubmit}
          className="p-4 md:p-5"
          style={{ borderTop: "1px solid #1f1f1f" }}
        >
          <div className="flex gap-3">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={isPostComplete ? "Ask about any design, book a visit..." : "Ask Meera about Hey Concrete..."}
              className="flex-1 rounded-full px-5 py-3 text-sm transition-all duration-150"
              style={{
                background: "#161616",
                border: "1px solid #2a2a2a",
                color: "#f5f0eb"
              }}
            />
            <button
              type="submit"
              disabled={sending}
              className="rounded-full px-6 py-3 text-sm font-semibold btn-amber disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
