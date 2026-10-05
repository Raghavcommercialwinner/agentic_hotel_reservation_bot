"""
ORM models for the hotel reservation system.

Key enterprise guarantee: the `bookings` table has a PostgreSQL EXCLUDE
constraint (via btree_gist) that makes it physically impossible to confirm two
overlapping bookings for the same room. Double-booking is prevented by the
database, not just by app code.
"""

import datetime
from sqlalchemy import (
    String, Integer, Numeric, ForeignKey, DateTime, Text,
    CheckConstraint, func, text,
)
from sqlalchemy.sql import literal_column
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ExcludeConstraint


class Base(DeclarativeBase):
    pass


class RoomType(Base):
    __tablename__ = "room_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2))
    capacity: Mapped[int] = mapped_column(Integer, default=2)
    description: Mapped[str] = mapped_column(Text, default="")
    rooms: Mapped[list["Room"]] = relationship(back_populates="room_type")


class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[int] = mapped_column(primary_key=True)
    room_number: Mapped[str] = mapped_column(String(10), unique=True)
    room_type_id: Mapped[int] = mapped_column(ForeignKey("room_types.id"))
    floor: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="active")
    room_type: Mapped[RoomType] = relationship(back_populates="rooms")
    __table_args__ = (
        CheckConstraint("status in ('active','maintenance')", name="room_status_chk"),
    )


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(120), unique=True)
    phone: Mapped[str] = mapped_column(String(30), default="")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    check_in: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    check_out: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    total_cost: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    created_by: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    room: Mapped[Room] = relationship()
    customer: Mapped[Customer] = relationship()
    __table_args__ = (
        CheckConstraint("check_out > check_in", name="valid_date_range"),
        CheckConstraint("status in ('confirmed','cancelled')", name="booking_status_chk"),
        # No two confirmed bookings for the same room may overlap in time.
        ExcludeConstraint(
            (literal_column("room_id"), "="),
            (literal_column("tstzrange(check_in, check_out)"), "&&"),
            using="gist",
            where=text("status = 'confirmed'"),
            name="no_double_booking",
        ),
    )


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    method: Mapped[str] = mapped_column(String(20))
    paid_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        CheckConstraint("method in ('credit_card','cash','online')", name="payment_method_chk"),
        CheckConstraint("amount > 0", name="payment_amount_chk"),
    )


class Staff(Base):
    __tablename__ = "staff"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(120), unique=True)  # Better Auth user id
    email: Mapped[str] = mapped_column(String(120), unique=True)
    role: Mapped[str] = mapped_column(String(20), default="receptionist")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        CheckConstraint("role in ('admin','receptionist')", name="staff_role_chk"),
    )


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_email: Mapped[str] = mapped_column(String(120), default="")
    action: Mapped[str] = mapped_column(String(40))
    entity: Mapped[str] = mapped_column(String(40), default="")
    entity_id: Mapped[str] = mapped_column(String(40), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
