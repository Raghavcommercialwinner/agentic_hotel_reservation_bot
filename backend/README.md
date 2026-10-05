# hotel_reservation — backend (enterprise)

Conversational hotel receptionist with a **safe, deterministic booking engine** and
a voice + text interface.

- **PostgreSQL + SQLAlchemy** — normalized schema (room_types, rooms, customers,
  bookings, payments, staff, audit_log).
- **No double-booking, guaranteed by the database**: the `bookings` table has a
  `btree_gist` `EXCLUDE` constraint, so two overlapping confirmed bookings for the
  same room are physically impossible (not just app-checked).
- **LLM never writes SQL.** It only extracts structured intent/slots (`nlu.py`); all
  data access is deterministic and parameterized (`booking_engine.py`).
- **No auth** — this is a phone-call simulator: a caller talks to the receptionist,
  so there is no staff login. All endpoints are open on localhost.
- **Voice** (`voice.py`): Google STT + Groq `playai-tts`.

## Prerequisites
- PostgreSQL running with a `hoteldb` database (creds in `.env`). The schema +
  `btree_gist` extension + seed rooms are created automatically on startup.
- **ffmpeg** on PATH (for `pydub` to decode browser webm audio).

## Setup
```bash
cd hotel_reservation/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python init_db.py        # optional: create schema + seed now
python main.py           # http://localhost:8000
```

## API (open — no auth)
Reception (voice + text): `POST /api/chat`, `POST /api/chat/audio`, `GET /api/audio/{f}`
Management: `GET /api/bookings`, `POST /api/bookings/{id}/cancel`,
`GET /api/rooms`, `GET /api/room_types`, `POST /api/availability`,
`POST /api/rooms`, `POST /api/room_types`

## Files
`db.py` (engine), `models.py` (ORM + EXCLUDE constraint), `init_db.py` (schema+seed),
`booking_engine.py` (availability/create/cancel), `nlu.py` (intent + reply),
`voice.py` (STT/TTS), `main.py` (API + orchestration).

The booking flow: user text → `nlu.extract_intent` (JSON) → orchestrator runs the
right `booking_engine` call → reply (deterministic for completed actions, LLM phrasing
otherwise). Browser handles text-to-speech.

## Agentic behaviour (verified)
- **Date/time aware**: the NLU is given the current date+time and resolves
  "today/tonight/tomorrow/next friday" to absolute dates.
- **Rejects past dates** (`booking_engine` + orchestration) and **flags
  contradictions** (check-out before check-in is surfaced, never silently swapped).
- **Handles mind-changes**: "small… actually large" uses the latest preference and
  carries earlier details (name/email/dates) across turns.
- **Reliable data retrieval**: a regex email fallback + deterministic lookup means
  "do I have a booking? my email is …" returns the actual bookings.
- **No double-booking**: enforced by the DB EXCLUDE constraint.

## Sample data
`python seed_samples.py` adds a few future bookings (idempotent). Used to populate
the Bookings tab and exercise retrieval.

Note: a legacy `hotel_booking` table from the earlier design still exists but is
unused by this system; it can be dropped safely if you want a clean schema.
