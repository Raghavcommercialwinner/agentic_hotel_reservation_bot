import React, { useState, useRef } from "react";

export default function ChatInput({ onSend, onVoiceSend }) {
  const [input, setInput] = useState("");
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  async function handleSend() {
    if (input.trim()) {
      onSend(input);
      setInput("");
    }
  }

  // Voice recording handlers
  async function startRecording() {
    if (!navigator.mediaDevices) {
      alert("Media devices not supported");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    audioChunks.current = [];

    mediaRecorder.current.ondataavailable = (e) => {
      audioChunks.current.push(e.data);
    };

    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
      onVoiceSend(audioBlob);
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.current.start();
  }

  function stopRecording() {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
    }
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <input
        type="text"
        placeholder="Type your message..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{ flex: 1, padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSend();
        }}
      />
      <button onClick={handleSend} style={{ padding: "0.5rem 1rem" }}>
        Send
      </button>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        style={{ padding: "0.5rem 1rem" }}
        title="Hold to talk"
      >
        🎤
      </button>
    </div>
  );
}
