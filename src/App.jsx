import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic } from "lucide-react";

const API_BASE = "http://localhost:8000/api";

const Ripple = () => (
  <motion.div
    className="absolute w-full h-full border-4 border-cyan-400 rounded-full opacity-70"
    initial={{ scale: 1, opacity: 0.6 }}
    animate={{ scale: 2.4, opacity: 0 }}
    transition={{ duration: 1.2, ease: "easeOut" }}
  />
);

const MicWithRipple = ({ listening, toggleMic, timer }) => (
  <div className="relative w-40 h-40 mb-8">
    <AnimatePresence>
      {listening &&
        Array.from({ length: 3 }).map((_, i) => (
          <Ripple key={i} />
        ))}
    </AnimatePresence>
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <button
        onClick={toggleMic}
        className={`w-40 h-40 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-2xl hover:scale-105 transition-all duration-300 ${
          listening ? "animate-pulse" : ""
        }`}
      >
        <Mic className="w-10 h-10" />
      </button>
      {listening && (
        <div className="mt-3 text-red-400 font-medium text-sm">
          Recording: {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
        </div>
      )}
    </div>
  </div>
);

function App() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [timer, setTimer] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [replyAudioUrl, setReplyAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showChatLog, setShowChatLog] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const replyAudioRef = useRef(null);

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setTimer(0);
    }
    return () => clearInterval(timerRef.current);
  }, [recording]);

  useEffect(() => {
    if (replyAudioUrl && replyAudioRef.current) {
      replyAudioRef.current.currentTime = 0;
      replyAudioRef.current.play().catch(() => {});
    }
  }, [replyAudioUrl]);

  const startRecording = async () => {
    setError("");
    setAudioBlob(null);
    setRecording(true);
    audioChunksRef.current = [];
    setReplyText("");
    setReplyAudioUrl("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
        sendAudio(blob);
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
      setRecording(false);
    }
  };

  const sendAudio = async (blob) => {
  setLoading(true);
  setError("");
  setReplyText("");
  setReplyAudioUrl("");
  try {
    const formData = new FormData();
    formData.append("file", blob, "voice.webm");
    const res = await fetch(`${API_BASE}/chat/audio`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("Backend error");
    const data = await res.json();

    const audioPath = `${API_BASE}/audio/${data.audio_url.split("/").pop()}`;
    setReplyText(data.text);
    setReplyAudioUrl(audioPath);
    setChatLog((log) => [
      ...log,
      { role: "user", text: data.user_transcript }, // 👈 Show transcribed voice input
      { role: "bot", text: data.text, audioUrl: audioPath },
    ]);
  } catch (e) {
    setError("Failed to connect to backend.");
  }
  setLoading(false);
};


  const sendChatText = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    setChatLog((log) => [...log, { role: "user", text: chatInput }]);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chatInput }),
      });
      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      const audioPath = `${API_BASE}/audio/${data.audio_url.split("/").pop()}`;
      setChatLog((log) => [
        ...log,
        { role: "bot", text: data.text, audioUrl: audioPath },
      ]);
    } catch (e) {
      setChatLog((log) => [...log, { role: "bot", text: "Backend error." }]);
    }
    setChatInput("");
    setChatLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-bl from-gray-800 via-gray-900 to-black text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-bold mb-6 drop-shadow-lg">Book now</h1>

      <MicWithRipple
        listening={recording}
        toggleMic={recording ? stopRecording : startRecording}
        timer={timer}
      />

      {loading && <div className="text-cyan-300 font-semibold mt-4">Processing...</div>}
      {error && (
        <div className="mt-4 p-3 bg-red-500/80 text-white rounded-lg max-w-sm text-center">
          {error}
        </div>
      )}

      {replyAudioUrl && (
        <audio ref={replyAudioRef} src={replyAudioUrl} autoPlay style={{ display: "none" }} />
      )}

      {replyText && (
        <div className="mt-6 bg-white/10 p-4 rounded-lg max-w-lg text-center shadow-inner">
          {replyText}
        </div>
      )}

      <button
        onClick={() => setShowChatLog((prev) => !prev)}
        className="mt-8 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 hover:scale-105 text-white rounded-lg shadow-lg transition-all duration-300"
      >
        {showChatLog ? "Hide Chat Log" : "Show Chat Log"}
      </button>

      {showChatLog && (
        <div className="fixed right-0 top-0 w-full max-w-md h-full bg-gray-900 z-50 flex flex-col border-l border-gray-700">
          <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-600">
            <h2 className="text-xl font-bold">Chat History</h2>
            <button onClick={() => setShowChatLog(false)} className="text-2xl text-red-400">
              &times;
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatLog.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs p-3 rounded-lg ${
                    msg.role === "user" ? "bg-cyan-600 text-white" : "bg-gray-700 text-gray-200"
                  }`}
                >
                  <div>{msg.text}</div>
                  {msg.audioUrl && (
                    <audio controls className="mt-2 w-full rounded">
                      <source src={msg.audioUrl} type="audio/wav" />
                    </audio>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="text-cyan-400 text-center font-semibold">Thinking...</div>
            )}
          </div>
          <div className="p-4 border-t border-gray-700 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChatText()}
              placeholder="Type a message..."
              className="flex-1 p-2 rounded-lg bg-gray-800 border border-gray-600 text-white"
              disabled={chatLoading}
            />
            <button
              onClick={sendChatText}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white"
              disabled={!chatInput.trim() || chatLoading}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
