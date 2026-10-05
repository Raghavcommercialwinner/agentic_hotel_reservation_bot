"""
Hotel reservation bot — enterprise backend (call simulator, no auth).

This is a phone-call simulator: a caller talks to the receptionist, so there is no
staff login. PostgreSQL (SQLAlchemy) with a DB-enforced no-double-booking
constraint, an LLM that only extracts structured intent (never SQL), a deterministic
booking engine, and the Groq voice pipeline.
"""

import os
import re
import json
import logging
import datetime

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _find_email(text):
    m = _EMAIL_RE.search(text or "")
    return m.group(0) if m else None

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from dotenv import load_dotenv

import init_db
import nlu
import voice
import booking_engine as be
from db import get_session
from models import RoomType, Room

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hotel Reservation (call simulator)")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attribution for bookings/audit (no staff accounts in a call simulator).
CALLER = "reception"


@app.on_event("startup")
def _startup():
    try:
        init_db.init()
        logger.info("Hotel DB ready (schema + seed).")
    except Exception as e:
        logger.error(f"DB init failed: {e}")


# ---------------- orchestration ----------------

def _money(x):
    return f"₹{float(x):,.0f}"


def _validate_window(ci, co):
    """Catch contradictions: past dates or check-out not after check-in."""
    today = datetime.datetime.now(datetime.timezone.utc).date()
    if ci.date() < today:
        return f"Those dates are in the past — today is {today}. Please choose future dates."
    if co <= ci:
        return "The check-out must be after the check-in. Could you clarify the dates?"
    return None


def handle_message(db: Session, text: str, history):
    intent = nlu.extract_intent(history, text)
    kind = intent.get("intent", "smalltalk")
    result = ""
    booking = None
    direct_reply = None  # deterministic reply for completed actions (no LLM hedging)

    # Robust email capture: fall back to a regex over the latest message + history
    # if the model didn't fill the email slot (needed to reliably retrieve data).
    if not intent.get("email"):
        found = _find_email(text)
        if not found:
            for h in reversed(history or []):
                found = _find_email(h.get("text", ""))
                if found:
                    break
        if found:
            intent["email"] = found
    try:
        if kind == "availability":
            ci, co = nlu.parse_window(intent)
            if not ci:
                result = "No dates given — ask the guest for check-in and check-out dates."
            elif _validate_window(ci, co):
                result = _validate_window(ci, co)
            else:
                result = f"Availability {ci.date()}→{co.date()}: " + json.dumps(be.availability_summary(db, ci, co))

        elif kind == "book":
            ci, co = nlu.parse_window(intent)
            window_err = _validate_window(ci, co) if ci else None
            missing = []
            if not intent.get("room_type"): missing.append("room type (small/medium/large)")
            if not ci: missing.append("check-in and check-out dates")
            if not intent.get("name"): missing.append("guest name")
            if not intent.get("email"): missing.append("email")
            if window_err:
                result = window_err
            elif missing:
                extra = ""
                if ci:
                    extra = " Availability: " + json.dumps(be.availability_summary(db, ci, co))
                result = "Still needed: " + ", ".join(missing) + "." + extra
            elif not intent.get("confirm"):
                rooms = be.available_rooms(db, intent["room_type"], ci, co)
                rt = next((t for t in be.list_room_types(db) if t.name.lower() == intent["room_type"].lower()), None)
                nights = max(1, (co.date() - ci.date()).days)
                total = float(rt.base_price) * nights if rt else 0
                if not rooms:
                    result = f"No {intent['room_type']} room free for {ci.date()}→{co.date()}; suggest other types or dates."
                else:
                    result = (f"A {intent['room_type']} room is available {ci.date()}→{co.date()} "
                              f"({nights} night(s), total {_money(total)}). Ask the guest to confirm to finalise.")
            else:
                try:
                    b = be.create_booking(
                        db, room_type=intent["room_type"], check_in=ci, check_out=co,
                        name=intent.get("name"), email=intent.get("email"), phone=intent.get("phone"),
                        payment_method=intent.get("payment_method"), created_by=CALLER,
                    )
                    booking = be.booking_to_dict(b)
                    result = "BOOKING CONFIRMED: " + json.dumps(booking)
                    nights = max(1, (co.date() - ci.date()).days)
                    direct_reply = (
                        f"You're all set, {booking['customer']}! I've confirmed your "
                        f"{booking['room_type']} room (Room {booking['room_number']}) from "
                        f"{ci.date()} to {co.date()} ({nights} night{'s' if nights > 1 else ''}), "
                        f"total {_money(booking['total_cost'])}. Is there anything else I can help you with?"
                    )
                except be.BookingError as e:
                    result = f"Booking could not be completed: {e}"

        elif kind == "inquire_bookings":
            email = intent.get("email")
            if not email:
                result = "Ask the guest for the email used for the booking."
            else:
                bs = be.bookings_for_email(db, email)
                if bs:
                    lines = [
                        f"#{b.id}: {b.room.room_type.name} room {b.room.room_number}, "
                        f"{b.check_in.date()} to {b.check_out.date()}, {b.status}, total {_money(b.total_cost)}"
                        for b in bs
                    ]
                    direct_reply = (f"I found {len(bs)} booking(s) for {email}:\n" + "\n".join(lines) +
                                    "\nIs there anything else I can help you with?")
                else:
                    direct_reply = f"I couldn't find any bookings under {email}. Would you like to make one?"

        elif kind == "cancel":
            bid = intent.get("booking_id")
            if not bid:
                result = "Ask the guest for the booking ID to cancel."
            else:
                try:
                    be.cancel_booking(db, int(bid), CALLER)
                    result = f"Booking #{bid} cancelled."
                    direct_reply = f"Done — booking #{bid} has been cancelled. Is there anything else I can help you with?"
                except be.BookingError as e:
                    result = str(e)
        else:
            result = "(General conversation — no booking action needed; be friendly and helpful.)"
    except Exception as e:
        logger.error(f"orchestration error: {e}")
        result = f"(Internal issue: {e})"

    # Deterministic reply for completed actions; LLM phrasing for everything else.
    reply = direct_reply or nlu.generate_reply(history, text, result)
    return {"reply": reply, "intent": kind, "booking": booking}


# ---------------- chat endpoints ----------------

class ChatRequest(BaseModel):
    text: str
    history: Optional[list] = None


@app.post("/api/chat")
async def chat(req: ChatRequest, db: Session = Depends(get_session)):
    out = handle_message(db, req.text, req.history)
    return {"text": out["reply"], "intent": out["intent"], "booking": out["booking"]}


@app.post("/api/chat/audio")
async def chat_audio(file: UploadFile = File(...), history: str = Form("[]"),
                     db: Session = Depends(get_session)):
    try:
        transcript = voice.transcribe(await file.read(), file.filename or "audio.webm")
    except Exception as e:
        raise HTTPException(400, detail=f"Could not transcribe audio: {e}")
    try:
        hist = json.loads(history)
    except Exception:
        hist = []
    out = handle_message(db, transcript, hist)
    return {"text": out["reply"], "user_transcript": transcript,
            "intent": out["intent"], "booking": out["booking"]}


# ---------------- management API (open) ----------------

@app.get("/api/room_types")
async def room_types(db: Session = Depends(get_session)):
    return {"room_types": [
        {"id": t.id, "name": t.name, "base_price": float(t.base_price), "capacity": t.capacity,
         "description": t.description} for t in be.list_room_types(db)]}


@app.get("/api/rooms")
async def rooms(db: Session = Depends(get_session)):
    return {"rooms": [
        {"id": r.id, "room_number": r.room_number, "type": r.room_type.name if r.room_type else None,
         "floor": r.floor, "status": r.status} for r in be.list_rooms(db)]}


class RoomTypeIn(BaseModel):
    name: str
    base_price: float
    capacity: int = 2
    description: str = ""


@app.post("/api/room_types")
async def add_room_type(body: RoomTypeIn, db: Session = Depends(get_session)):
    rt = RoomType(name=body.name.lower(), base_price=body.base_price, capacity=body.capacity, description=body.description)
    db.add(rt)
    be.audit(db, CALLER, "add_room_type", "room_type", "", body.name)
    db.commit()
    return {"message": f"Room type '{body.name}' added", "id": rt.id}


class RoomIn(BaseModel):
    room_number: str
    room_type: str
    floor: int = 1


@app.post("/api/rooms")
async def add_room(body: RoomIn, db: Session = Depends(get_session)):
    rt = next((t for t in be.list_room_types(db) if t.name.lower() == body.room_type.lower()), None)
    if not rt:
        raise HTTPException(400, detail=f"Unknown room type '{body.room_type}'")
    room = Room(room_number=body.room_number, room_type_id=rt.id, floor=body.floor)
    db.add(room)
    be.audit(db, CALLER, "add_room", "room", body.room_number, body.room_type)
    db.commit()
    return {"message": f"Room {body.room_number} added", "id": room.id}


@app.get("/api/bookings")
async def list_bookings(db: Session = Depends(get_session)):
    return {"bookings": [be.booking_to_dict(b) for b in be.all_bookings(db)]}


@app.post("/api/bookings/{booking_id}/cancel")
async def cancel(booking_id: int, db: Session = Depends(get_session)):
    try:
        be.cancel_booking(db, booking_id, CALLER)
        return {"message": f"Booking #{booking_id} cancelled"}
    except be.BookingError as e:
        raise HTTPException(404, detail=str(e))


class AvailabilityIn(BaseModel):
    check_in: str
    check_out: str


@app.post("/api/availability")
async def availability(body: AvailabilityIn, db: Session = Depends(get_session)):
    ci, co = nlu.parse_window({"check_in": body.check_in, "check_out": body.check_out})
    if not ci:
        raise HTTPException(400, detail="Invalid dates")
    return {"availability": be.availability_summary(db, ci, co),
            "check_in": ci.isoformat(), "check_out": co.isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
