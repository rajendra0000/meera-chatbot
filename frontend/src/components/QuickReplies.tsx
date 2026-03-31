export function QuickReplies({
  replies,
  onSelect
}: {
  replies: string[];
  onSelect: (value: string) => void;
}) {
  if (!replies.length) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2 animate-fade-up">
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={() => onSelect(reply)}
          className="rounded-full px-4 py-2 text-sm transition-all duration-150"
          style={{
            background: "transparent",
            border: "1px solid #2a2a2a",
            color: "#b8b0a4"
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,169,110,0.5)";
            (e.currentTarget as HTMLElement).style.color = "#e2c98f";
            (e.currentTarget as HTMLElement).style.background = "rgba(61,46,26,0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#2a2a2a";
            (e.currentTarget as HTMLElement).style.color = "#b8b0a4";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
