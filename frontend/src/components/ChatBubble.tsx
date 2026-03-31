export function ChatBubble({ role, content }: { role: "USER" | "ASSISTANT"; content: string }) {
  const isUser = role === "USER";

  return (
    <div className={`flex animate-fade-up ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div
          className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          style={{ background: "#3d2e1a", color: "#c8a96e" }}
        >
          M
        </div>
      )}
      <div
        className="max-w-[80%] rounded-[20px] px-4 py-3 text-sm leading-relaxed shadow-soft"
        style={
          isUser
            ? {
                background: "linear-gradient(135deg, #e2c98f, #c8a96e)",
                color: "#261900",
                borderRadius: "20px 20px 4px 20px",
                fontWeight: 500
              }
            : {
                background: "#161616",
                color: "#f5f0eb",
                border: "1px solid #2a2a2a",
                borderLeft: "2px solid rgba(200,169,110,0.25)",
                borderRadius: "20px 20px 20px 4px"
              }
        }
      >
        {content.split("\n").map((line, index) => (
          <p key={`${role}-${index}`} className={index === 0 ? "" : "mt-1"} style={{ whiteSpace: "pre-wrap" }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
