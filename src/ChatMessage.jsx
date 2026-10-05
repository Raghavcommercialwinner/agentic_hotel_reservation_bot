export default function ChatMessage({ role, text, audioUrl }) {
  const isUser = role === "user";

  return (
    <div
      style={{
        textAlign: isUser ? "right" : "left",
        margin: "0.5rem 0",
      }}
    >
      <div
        style={{
          display: "inline-block",
          background: isUser ? "#007bff" : "#e5e5ea",
          color: isUser ? "white" : "black",
          padding: "0.5rem 1rem",
          borderRadius: "15px",
          maxWidth: "80%",
          wordWrap: "break-word",
        }}
      >
        {text}
        {audioUrl && (
          <audio
            style={{ marginTop: "0.3rem" }}
            src={audioUrl}
            controls
            preload="auto"
          />
        )}
      </div>
    </div>
  );
}
