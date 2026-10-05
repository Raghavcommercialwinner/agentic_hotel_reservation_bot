"""
Natural-language understanding for the receptionist bot.

The LLM does TWO safe things only:
  1. extract_intent(): turn the conversation into structured JSON (intent + slots).
  2. generate_reply(): phrase a friendly response given a deterministic result.

It never produces SQL. All database actions are done by booking_engine.py.
"""

import os
import json
import datetime
from groq import Groq
from dateutil import parser as dateparser

CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.1-8b-instant")


def _client():
    return Groq(api_key=os.environ.get("GROQ_API_KEY"))


INTENT_SYSTEM = """You are the NLU module of a hotel receptionist system.
The current date and time is {now} ({weekday}).

Read the conversation and the latest user message and output ONLY a JSON object
with these fields (use null when unknown):

{{
  "intent": one of ["book","availability","inquire_bookings","cancel","smalltalk","other"],
  "room_type": one of ["small","medium","large"] or null,
  "check_in": "YYYY-MM-DD" or null,
  "check_out": "YYYY-MM-DD" or null,
  "name": string or null,
  "email": string or null,
  "phone": string or null,
  "payment_method": one of ["credit_card","cash","online"] or null,
  "booking_id": integer or null,
  "confirm": true if the user explicitly confirms/commits the booking, else false
}}

Rules:
- Resolve every relative date/time ("today", "tonight", "tomorrow", "this weekend",
  "next friday") to an absolute YYYY-MM-DD using the current date above.
- If the user CHANGES THEIR MIND (e.g. first says "small" then "large", or revises the
  dates), always use their MOST RECENT stated preference.
- Preserve check_in and check_out exactly as the user states them. Do NOT swap or
  reorder them even if check_out appears to be before check_in (the system validates).
- Carry over details already given earlier in the conversation (name, email, dates,
  room type) even when the latest message doesn't repeat them.
- Only set confirm=true when the user clearly says yes / confirm / book it.
Output JSON only, no prose."""


def extract_intent(history, message):
    now = datetime.datetime.now()
    messages = [{"role": "system", "content": INTENT_SYSTEM.format(
        now=now.strftime("%Y-%m-%d %H:%M"), weekday=now.strftime("%A"))}]
    for h in (history or [])[-8:]:
        role = "user" if h.get("sender") == "user" else "assistant"
        if h.get("text"):
            messages.append({"role": role, "content": h["text"]})
    messages.append({"role": "user", "content": message})
    try:
        resp = _client().chat.completions.create(
            model=CHAT_MODEL, messages=messages, temperature=0,
            response_format={"type": "json_object"}, max_tokens=400,
        )
        data = json.loads(resp.choices[0].message.content)
    except Exception:
        data = {}
    data.setdefault("intent", "smalltalk")
    return data


def parse_window(intent):
    """Return (check_in, check_out) as aware datetimes, or (None, None)."""
    ci = intent.get("check_in")
    co = intent.get("check_out")
    if not ci:
        return None, None
    tz = datetime.timezone.utc
    try:
        check_in = dateparser.parse(ci).replace(hour=14, minute=0, second=0, microsecond=0, tzinfo=tz)
    except Exception:
        return None, None
    if co:
        try:
            check_out = dateparser.parse(co).replace(hour=11, minute=0, second=0, microsecond=0, tzinfo=tz)
        except Exception:
            check_out = check_in + datetime.timedelta(days=1)
    else:
        check_out = check_in + datetime.timedelta(days=1)
    return check_in, check_out


REPLY_SYSTEM = """You are a warm, professional hotel receptionist.
Speak naturally and concisely. Use the SYSTEM RESULT below as the single source of
truth — never invent availability, prices or bookings beyond it.

- If SYSTEM RESULT starts with "BOOKING CONFIRMED", the booking is DONE: cheerfully
  confirm it back to the guest with the room number, dates and total. Do NOT ask for
  more details and do NOT ask them to confirm again.
- If it reports an error or no availability, explain kindly and suggest alternatives.
- Otherwise, guide the guest to the next step, asking only for the missing detail
  (room type, dates, name, email, then confirmation).
Do not mention SQL, databases or internal mechanics."""


def generate_reply(history, message, system_result):
    messages = [{"role": "system", "content": REPLY_SYSTEM}]
    for h in (history or [])[-6:]:
        role = "user" if h.get("sender") == "user" else "assistant"
        if h.get("text"):
            messages.append({"role": role, "content": h["text"]})
    messages.append({"role": "user", "content": message})
    messages.append({"role": "system", "content": f"SYSTEM RESULT:\n{system_result}"})
    try:
        resp = _client().chat.completions.create(
            model=CHAT_MODEL, messages=messages, temperature=0.4, max_tokens=400,
        )
        return resp.choices[0].message.content
    except Exception as e:
        return f"Sorry, I'm having trouble responding right now. ({e})"
