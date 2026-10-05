"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const Ripple = () => (
  <motion.div className="absolute w-full h-full border-4 border-cyan-400 rounded-full opacity-70"
    initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 1.2, ease: "easeOut" }} />
);

export default function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // Speak the receptionist's reply using the browser's built-in voice.
  const speak = (txt) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.rate = 1; u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const pushBot = (data) => {
    speak(data.text);
    setMessages((m) => [...m, { sender: "bot", text: data.text, booking: data.booking }]);
  };

  const sendText = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { sender: "user", text: input };
    const history = messages.slice(-8);
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userMsg.text, history }),
      });
      if (res.status === 401) setMessages((m) => [...m, { sender: "bot", text: "Session expired — please sign in again.", error: true }]);
      else if (!res.ok) setMessages((m) => [...m, { sender: "bot", text: "Backend error.", error: true }]);
      else pushBot(await res.json());
    } catch {
      setMessages((m) => [...m, { sender: "bot", text: "Could not reach the backend.", error: true }]);
    }
    setLoading(false);
  };

  const startRec = async () => {
    setRecording(true);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); sendAudio(new Blob(chunksRef.current, { type: "audio/webm" })); };
      mr.start();
    } catch { setRecording(false); }
  };
  const stopRec = () => { mediaRecorderRef.current?.stop(); setRecording(false); };

  const sendAudio = async (blob) => {
    setLoading(true);
    const history = messages.slice(-8);
    try {
      const fd = new FormData();
      fd.append("file", blob, "voice.webm");
      fd.append("history", JSON.stringify(history));
      const res = await fetch(`${API}/chat/audio`, { method: "POST", credentials: "include", body: fd });
      if (!res.ok) { setMessages((m) => [...m, { sender: "bot", text: "Could not process audio.", error: true }]); }
      else {
        const data = await res.json();
        setMessages((m) => [...m, { sender: "user", text: data.user_transcript || "[voice]" }]);
        pushBot(data);
      }
    } catch {
      setMessages((m) => [...m, { sender: "bot", text: "Could not reach the backend.", error: true }]);
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col items-center">
      <div className="flex-1 w-full max-w-3xl overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-16">
            👋 Welcome. Speak or type — e.g. <em>“I’d like a medium room from Jan 10 to Jan 12.”</em>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl whitespace-pre-wrap ${
              m.sender === "user" ? "bg-cyan-600 text-white rounded-br-none"
              : m.error ? "bg-red-900/50 text-red-200" : "bg-gray-800 text-gray-100 rounded-bl-none"}`}>
              {m.text}
              {m.booking && (
                <div className="mt-3 p-3 rounded-lg bg-green-900/40 border border-green-600/40 text-sm">
                  <div className="font-semibold text-green-300 mb-1">✅ Booking #{m.booking.id} confirmed</div>
                  Room {m.booking.room_number} ({m.booking.room_type}) · {String(m.booking.check_in).slice(0,10)} → {String(m.booking.check_out).slice(0,10)} · ₹{m.booking.total_cost}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-cyan-300 text-sm">Thinking…</div>}
        <div ref={endRef} />
      </div>

      <div className="w-full max-w-3xl p-4 flex items-center gap-3">
        <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
          <AnimatePresence>{recording && [0, 1].map((i) => <Ripple key={i} />)}</AnimatePresence>
          <button onClick={recording ? stopRec : startRec}
            className={`w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 text-white ${recording ? "animate-pulse" : ""}`}
            title={recording ? "Stop" : "Speak"}>
            <Mic className="w-5 h-5" />
          </button>
        </div>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendText()}
          placeholder="Type a message…" disabled={loading}
          className="flex-1 h-12 px-4 rounded-xl bg-gray-800 border border-gray-600 text-white outline-none focus:ring-2 focus:ring-cyan-500" />
        <button onClick={sendText} disabled={!input.trim() || loading}
          className="h-12 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white font-semibold">Send</button>
      </div>
    </div>
  );
}
