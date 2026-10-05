# hotel_reservation — frontend (Next.js 16)

Call-simulator UI for the hotel reservation system — **no login** (a caller talking
to the receptionist doesn't authenticate). Opens straight into:
- **Reception**: voice + text booking chat; shows confirmation cards.
- **Bookings & Rooms**: live bookings table with cancel; rooms/room-types view; add
  rooms and room types.

## Setup
```bash
cd hotel_reservation/frontend
npm install
npm run dev          # http://localhost:3000
```

Env in `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000/api`.

Start the backend first (`../backend/README.md`). Click the mic to speak or type.
Mic capture requires `localhost` or HTTPS.

> Run one app at a time (mmrag and hotel both use :3000/:8000).
