"use client";

import React, { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function ManagePanel() {
  const [tab, setTab] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [types, setTypes] = useState([]);
  const [error, setError] = useState("");

  // admin forms
  const [newRoom, setNewRoom] = useState({ room_number: "", room_type: "small", floor: 1 });
  const [newType, setNewType] = useState({ name: "", base_price: 2500, capacity: 2, description: "" });

  const refresh = useCallback(async () => {
    setError("");
    try {
      const opts = { credentials: "include" };
      const [b, r, t] = await Promise.all([
        fetch(`${API}/bookings`, opts).then((x) => x.json()),
        fetch(`${API}/rooms`, opts).then((x) => x.json()),
        fetch(`${API}/room_types`, opts).then((x) => x.json()),
      ]);
      setBookings(b.bookings || []);
      setRooms(r.rooms || []);
      setTypes(t.room_types || []);
    } catch { setError("Could not load data."); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const cancelBooking = async (id) => {
    if (!confirm(`Cancel booking #${id}?`)) return;
    await fetch(`${API}/bookings/${id}/cancel`, { method: "POST", credentials: "include" });
    refresh();
  };

  const addRoom = async () => {
    const res = await fetch(`${API}/rooms`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRoom) });
    if (!res.ok) { const d = await res.json(); alert(d.detail || "Failed"); return; }
    setNewRoom({ room_number: "", room_type: "small", floor: 1 });
    refresh();
  };

  const addType = async () => {
    const res = await fetch(`${API}/room_types`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newType) });
    if (!res.ok) { const d = await res.json(); alert(d.detail || "Failed"); return; }
    setNewType({ name: "", base_price: 2500, capacity: 2, description: "" });
    refresh();
  };

  const isAdmin = true; // call simulator: no roles, management always available

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex gap-2 mb-4">
          {[["bookings", `Bookings (${bookings.length})`], ["rooms", `Rooms (${rooms.length})`]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === k ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>{label}</button>
          ))}
          <button onClick={refresh} className="ml-auto px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm">⟳ Refresh</button>
        </div>
        {error && <div className="mb-3 p-2 bg-red-600/70 rounded text-sm">{error}</div>}

        {tab === "bookings" && (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/70 text-gray-300">
                <tr>{["#", "Room", "Type", "Guest", "Email", "Check-in", "Check-out", "Total", "Status", ""].map((h) => <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t border-gray-800">
                    <td className="px-3 py-2">{b.id}</td>
                    <td className="px-3 py-2">{b.room_number}</td>
                    <td className="px-3 py-2">{b.room_type}</td>
                    <td className="px-3 py-2">{b.customer}</td>
                    <td className="px-3 py-2 text-gray-400">{b.email}</td>
                    <td className="px-3 py-2">{String(b.check_in).slice(0, 10)}</td>
                    <td className="px-3 py-2">{String(b.check_out).slice(0, 10)}</td>
                    <td className="px-3 py-2">₹{b.total_cost}</td>
                    <td className="px-3 py-2"><span className={b.status === "confirmed" ? "text-green-400" : "text-gray-500 line-through"}>{b.status}</span></td>
                    <td className="px-3 py-2">{b.status === "confirmed" && <button onClick={() => cancelBooking(b.id)} className="text-red-400 hover:text-red-300 text-xs">cancel</button>}</td>
                  </tr>
                ))}
                {bookings.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-500">No bookings yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "rooms" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {rooms.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="font-semibold">Room {r.room_number}</div>
                  <div className="text-sm text-gray-400">{r.type} · floor {r.floor} · {r.status}</div>
                </div>
              ))}
            </div>

            <div className="text-sm text-gray-400">
              Room types: {types.map((t) => `${t.name} (₹${t.base_price})`).join(", ")}
            </div>

            {isAdmin ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gray-900 border border-gray-700">
                  <h3 className="font-semibold mb-2">Add room</h3>
                  <div className="space-y-2">
                    <input placeholder="Room number" value={newRoom.room_number} onChange={(e) => setNewRoom({ ...newRoom, room_number: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm" />
                    <select value={newRoom.room_type} onChange={(e) => setNewRoom({ ...newRoom, room_type: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm">
                      {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                    <input type="number" placeholder="Floor" value={newRoom.floor} onChange={(e) => setNewRoom({ ...newRoom, floor: Number(e.target.value) })} className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm" />
                    <button onClick={addRoom} className="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-sm font-semibold">Add room</button>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-gray-900 border border-gray-700">
                  <h3 className="font-semibold mb-2">Add room type</h3>
                  <div className="space-y-2">
                    <input placeholder="Name (e.g. deluxe)" value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm" />
                    <input type="number" placeholder="Price/night" value={newType.base_price} onChange={(e) => setNewType({ ...newType, base_price: Number(e.target.value) })} className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm" />
                    <input type="number" placeholder="Capacity" value={newType.capacity} onChange={(e) => setNewType({ ...newType, capacity: Number(e.target.value) })} className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm" />
                    <button onClick={addType} className="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-sm font-semibold">Add type</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Sign in as an admin to add rooms or room types.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
