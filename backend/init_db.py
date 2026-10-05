"""
Schema bootstrap + seed for the hotel reservation system.

Creates the btree_gist extension (needed for the no-double-booking EXCLUDE
constraint), all tables, and seeds a default set of room types and rooms if the
inventory is empty. Idempotent — safe to run on every startup.

Run directly to (re)initialise:  python init_db.py
"""

from sqlalchemy import text, select, func
from db import engine, SessionLocal
from models import Base, RoomType, Room

# Default inventory (configurable — edit or manage via the admin API/UI).
SEED_ROOM_TYPES = [
    {"name": "small",  "base_price": 2000, "capacity": 1, "description": "Cozy single room"},
    {"name": "medium", "base_price": 3000, "capacity": 2, "description": "Comfortable double room"},
    {"name": "large",  "base_price": 4000, "capacity": 4, "description": "Spacious suite"},
]
SEED_ROOMS = [
    {"room_number": "101", "type": "small",  "floor": 1},
    {"room_number": "102", "type": "large",  "floor": 1},
    {"room_number": "103", "type": "medium", "floor": 1},
    {"room_number": "201", "type": "small",  "floor": 2},
    {"room_number": "202", "type": "medium", "floor": 2},
    {"room_number": "203", "type": "large",  "floor": 2},
]


def ensure_schema():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
    Base.metadata.create_all(engine)


def seed_inventory():
    with SessionLocal() as db:
        existing = db.scalar(select(func.count()).select_from(RoomType))
        if existing:
            return
        types = {}
        for t in SEED_ROOM_TYPES:
            rt = RoomType(name=t["name"], base_price=t["base_price"],
                          capacity=t["capacity"], description=t["description"])
            db.add(rt)
            types[t["name"]] = rt
        db.flush()
        for r in SEED_ROOMS:
            db.add(Room(room_number=r["room_number"], room_type_id=types[r["type"]].id, floor=r["floor"]))
        db.commit()


def init():
    ensure_schema()
    seed_inventory()


if __name__ == "__main__":
    init()
    print("Hotel DB initialised and seeded.")
