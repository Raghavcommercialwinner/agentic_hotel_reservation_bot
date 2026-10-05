"""
Deterministic booking engine — all data access is safe and parameterized.

The LLM never writes SQL here; it only extracts intent/slots (see nlu.py). This
module turns that structured intent into correct, transactional database
operations, with the no-double-booking guarantee enforced by the DB constraint.
"""

import datetime
from decimal import Decimal
from sqlalchemy import select, func, exists
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import RoomType, Room, Customer, Booking, Payment, Staff, AuditLog


class BookingError(Exception):
    pass


def _nights(check_in, check_out) -> int:
    return max(1, (check_out.date() - check_in.date()).days)


def audit(db: Session, user_email, action, entity="", entity_id="", detail=""):
    db.add(AuditLog(user_email=user_email or "", action=action, entity=entity,
                    entity_id=str(entity_id), detail=str(detail)))


# ---------------- inventory ----------------

def list_room_types(db: Session):
    return db.scalars(select(RoomType).order_by(RoomType.base_price)).all()


def list_rooms(db: Session):
    return db.scalars(select(Room).order_by(Room.room_number)).all()


def available_rooms(db: Session, room_type_name, check_in, check_out):
    """Active rooms of a type with no overlapping confirmed booking."""
    overlap = (
        select(Booking.id)
        .where(
            Booking.room_id == Room.id,
            Booking.status == "confirmed",
            Booking.check_in < check_out,
            Booking.check_out > check_in,
        )
    )
    stmt = (
        select(Room).join(RoomType)
        .where(Room.status == "active", ~exists(overlap))
    )
    if room_type_name:
        stmt = stmt.where(func.lower(RoomType.name) == room_type_name.lower())
    return db.scalars(stmt.order_by(Room.room_number)).all()


def availability_summary(db: Session, check_in, check_out):
    """Counts of available rooms per type for a window."""
    out = {}
    for rt in list_room_types(db):
        rooms = available_rooms(db, rt.name, check_in, check_out)
        out[rt.name] = {"available": len(rooms), "price_per_night": float(rt.base_price)}
    return out


# ---------------- customers ----------------

def upsert_customer(db: Session, name, email, phone) -> Customer:
    if not email:
        raise BookingError("A customer email is required to make a booking.")
    cust = db.scalar(select(Customer).where(func.lower(Customer.email) == email.lower()))
    if cust:
        if name and not cust.name:
            cust.name = name
        if phone and not cust.phone:
            cust.phone = phone
    else:
        cust = Customer(name=name or email, email=email, phone=phone or "")
        db.add(cust)
        db.flush()
    return cust


# ---------------- bookings ----------------

def create_booking(db: Session, *, room_type, check_in, check_out,
                   name, email, phone, payment_method=None, created_by=""):
    today = datetime.datetime.now(datetime.timezone.utc).date()
    if check_in.date() < today:
        raise BookingError(f"Check-in {check_in.date()} is in the past (today is {today}). Please pick a future date.")
    if check_out <= check_in:
        raise BookingError("Check-out must be after check-in.")
    rt = db.scalar(select(RoomType).where(func.lower(RoomType.name) == (room_type or "").lower()))
    if not rt:
        raise BookingError(f"Unknown room type '{room_type}'. Choose from small, medium or large.")

    rooms = available_rooms(db, room_type, check_in, check_out)
    if not rooms:
        raise BookingError(f"No {room_type} room is available for those dates.")

    customer = upsert_customer(db, name, email, phone)
    nights = _nights(check_in, check_out)
    total = Decimal(rt.base_price) * nights
    room = rooms[0]

    booking = Booking(
        room_id=room.id, customer_id=customer.id,
        check_in=check_in, check_out=check_out,
        status="confirmed", total_cost=total, created_by=created_by,
    )
    db.add(booking)
    try:
        db.flush()  # triggers the no_double_booking EXCLUDE constraint
    except IntegrityError:
        db.rollback()
        raise BookingError(f"That {room_type} room was just taken for those dates. Please try different dates.")

    if payment_method:
        db.add(Payment(booking_id=booking.id, amount=total, method=payment_method))

    audit(db, created_by, "create_booking", "booking", booking.id,
          f"{room_type} room {room.room_number} for {email} {check_in.date()}→{check_out.date()}")
    db.commit()
    return booking


def cancel_booking(db: Session, booking_id, by_email=""):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise BookingError(f"Booking #{booking_id} not found.")
    booking.status = "cancelled"
    audit(db, by_email, "cancel_booking", "booking", booking_id, "")
    db.commit()
    return booking


def bookings_for_email(db: Session, email):
    return db.scalars(
        select(Booking).join(Customer)
        .where(func.lower(Customer.email) == (email or "").lower())
        .order_by(Booking.check_in.desc())
    ).all()


def all_bookings(db: Session, limit=200):
    return db.scalars(select(Booking).order_by(Booking.check_in.desc()).limit(limit)).all()


def booking_to_dict(b: Booking):
    return {
        "id": b.id,
        "room_number": b.room.room_number if b.room else None,
        "room_type": b.room.room_type.name if b.room and b.room.room_type else None,
        "customer": b.customer.name if b.customer else None,
        "email": b.customer.email if b.customer else None,
        "check_in": b.check_in.isoformat() if b.check_in else None,
        "check_out": b.check_out.isoformat() if b.check_out else None,
        "status": b.status,
        "total_cost": float(b.total_cost or 0),
        "created_by": b.created_by,
    }
