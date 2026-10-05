import React, { useState, useRef } from "react";

const API_BASE = "http://localhost:8000"; // Change if needed

function HotelChat() {
  const [messages, setMessages] = useState([]); // {role, text, audioUrl?}
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Send text message
  const sendText = async () => {
    if (!input.trim()) return;
    setError("");
    setLoading(true);
    setMessages((msgs) => [...msgs, { role: "user", text: input }]);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      setMessages((msgs) => [
        ...msgs,
        { role: "bot", text: data.text, audioUrl: API_BASE + data.audio_url },
      ]);
    } catch (e) {
      setError("Failed to connect to backend.");
    }
    setInput("");
    setLoading(false);
  };

  // Voice recording
  const startRecording = async () => {
    setError("");
    setAudioBlob(null);
    setRecording(true);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setAudioBlob(blob);
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
    } catch (e) {
      setError("Microphone access denied.");
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  // Send audio message
  const sendAudio = async () => {
    if (!audioBlob) return;
    setError("");
    setLoading(true);
    setMessages((msgs) => [...msgs, { role: "user", text: "[voice message]" }]);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "voice.wav");
      const res = await fetch(`${API_BASE}/chat/audio`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      setMessages((msgs) => [
        ...msgs,
        { role: "bot", text: data.text, audioUrl: API_BASE + data.audio_url },
      ]);
      setAudioBlob(null);
    } catch (e) {
      setError("Failed to connect to backend.");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Hotel Voice Chatbot</h2>
      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, minHeight: 300, background: "#fafbfc" }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ margin: "12px 0", textAlign: msg.role === "user" ? "right" : "left" }}>
            <div
              style={{
                display: "inline-block",
                background: msg.role === "user" ? "#e3f2fd" : "#e0e0e0",
                padding: "8px 14px",
                borderRadius: 16,
                maxWidth: "80%",
                wordBreak: "break-word",
              }}
            >
              {msg.text}
              {msg.audioUrl && (
                <audio controls style={{ display: "block", marginTop: 8 }}>
                  <source src={msg.audioUrl} type="audio/wav" />
                  Your browser does not support the audio element.
                </audio>
              )}
            </div>
          </div>
        ))}
        {loading && <div style={{ textAlign: "center", color: "#888" }}>Loading...</div>}
        {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
      </div>

      {/* Text input */}
      <div style={{ display: "flex", marginTop: 16, gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #bbb" }}
          onKeyDown={(e) => e.key === "Enter" && sendText()}
          disabled={recording || loading}
        />
        <button onClick={sendText} disabled={!input.trim() || recording || loading}>
          Send
        </button>
      </div>

      {/* Voice controls */}
      <div style={{ marginTop: 12 }}>
        {!recording && (
          <button onClick={startRecording} style={{ marginRight: 8 }} disabled={loading}>
            🎤 Start Voice
          </button>
        )}
        {recording && (
          <button onClick={stopRecording} style={{ background: "#e57373", color: "#fff" }}>
            ⏹️ Stop
          </button>
        )}
        {audioBlob && (
          <button onClick={sendAudio} style={{ marginLeft: 8 }} disabled={loading}>
            ⬆️ Send Voice
          </button>
        )}
        {audioBlob && (
          <audio controls style={{ marginLeft: 8 }}>
            <source src={URL.createObjectURL(audioBlob)} type="audio/wav" />
          </audio>
        )}
      </div>
    </div>
  );
}

export default HotelChat;
