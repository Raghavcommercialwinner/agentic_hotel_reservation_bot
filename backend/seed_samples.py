"""
Seed a few realistic sample bookings (future dates) so the Bookings tab and the
'inquire about my booking' flow have data. Idempotent: skips guests who already
have a booking.

Run:  python seed_samples.py
"""

import datetime
from db import SessionLocal
import booking_engine as be
import init_db

SAMPLES = [
    # name, email, phone, room_type, days_from_today_in, days_from_today_out
    ("Alice Walker",  "alice@example.com",  "9000000001", "small",  7,  9),
    ("Bob Singh",     "bob@example.com",    "9000000002", "medium", 8,  11),
    ("Carla Mendes",  "carla@example.com",  "9000000003", "large",  10, 12),
    ("David Okonkwo", "david@example.com",  "9000000004", "small",  14, 16),
]


def run():
    init_db.init()
    db = SessionLocal()
    tz = datetime.timezone.utc
    base = datetime.datetime.now(tz).date()
    for name, email, phone, rt, d1, d2 in SAMPLES:
        if be.bookings_for_email(db, email):
            print(f"skip (already has booking): {name}")
            continue
        ci = datetime.datetime.combine(base + datetime.timedelta(days=d1), datetime.time(14), tz)
        co = datetime.datetime.combine(base + datetime.timedelta(days=d2), datetime.time(11), tz)
        try:
            b = be.create_booking(db, room_type=rt, check_in=ci, check_out=co, name=name,
                                  email=email, phone=phone, payment_method="online", created_by="seed")
            print(f"added: {name:14} {rt:7} room {b.room.room_number}  {ci.date()} to {co.date()}  total {be.booking_to_dict(b)['total_cost']}")
        except be.BookingError as e:
            print(f"skip ({e}): {name}")
    db.close()


if __name__ == "__main__":
    run()
