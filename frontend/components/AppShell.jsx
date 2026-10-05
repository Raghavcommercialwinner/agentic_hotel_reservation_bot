"use client";

import React, { useState } from "react";
import ChatPanel from "./ChatPanel";
import ManagePanel from "./ManagePanel";

export default function AppShell() {
  const [view, setView] = useState("reception");

  return (
    <div className="h-screen flex flex-col bg-gradient-to-bl from-gray-800 via-gray-900 to-black text-white">
      <header className="h-14 shrink-0 border-b border-gray-800 flex items-center justify-between px-5 bg-black/40">
        <div className="flex items-center gap-6">
          <div className="font-bold text-lg">Athens Hotel <span className="text-cyan-400 text-xs font-normal">call simulator</span></div>
          <nav className="flex gap-1">
            {[["reception", "Reception"], ["manage", "Bookings & Rooms"]].map(([k, label]) => (
              <button key={k} onClick={() => setView(k)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${view === k ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="text-xs text-gray-500">incoming call · receptionist bot</div>
      </header>

      <main className="flex-1 min-h-0">
        {view === "reception" ? <ChatPanel /> : <ManagePanel />}
      </main>
    </div>
  );
}
