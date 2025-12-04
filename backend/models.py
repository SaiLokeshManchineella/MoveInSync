from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, Enum, Time
)
from sqlalchemy.orm import relationship, declarative_base
import enum
from database import Base

# ----------------------------
# ENUM DEFINITIONS
# ----------------------------
class RouteStatus(enum.Enum):
    active = "active"
    deactivated = "deactivated"


class VehicleType(enum.Enum):
    bus = "bus"
    cab = "cab"


# ----------------------------
# STATIC ASSETS
# ----------------------------

class Stop(Base):
    __tablename__ = "stops"

    stop_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Relationships
    path_stops = relationship("PathStop", back_populates="stop")


class Path(Base):
    __tablename__ = "paths"

    path_id = Column(Integer, primary_key=True, index=True)
    path_name = Column(String, nullable=True)

    # Relationship to ordered stops
    stops = relationship("PathStop", back_populates="path", cascade="all, delete-orphan")

    # Relationship to routes
    routes = relationship("Route", back_populates="path")


class PathStop(Base):
    """
    Many-to-many with ordering between Path and Stop.
    Stores the stop sequence in a given path.
    """
    __tablename__ = "path_stops"

    id = Column(Integer, primary_key=True)
    path_id = Column(Integer, ForeignKey("paths.path_id"))
    stop_id = Column(Integer, ForeignKey("stops.stop_id"))
    stop_order = Column(Integer, nullable=False)

    path = relationship("Path", back_populates="stops")
    stop = relationship("Stop", back_populates="path_stops")


class Route(Base):
    __tablename__ = "routes"

    route_id = Column(Integer, primary_key=True, index=True)
    path_id = Column(Integer, ForeignKey("paths.path_id"), nullable=True)
    route_display_name = Column(String, nullable=True)
    shift_time = Column(Time, nullable=True)
    direction = Column(String, nullable=True)
    start_point = Column(String, nullable=True)
    end_point = Column(String, nullable=True)
    status = Column(Enum(RouteStatus), default=RouteStatus.active)
    capacity = Column(Integer, nullable=True)
    allocated_waitlist = Column(Integer, nullable=True, default=0)

    # Relationships
    path = relationship("Path", back_populates="routes")
    daily_trips = relationship("DailyTrip", back_populates="route")


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id = Column(Integer, primary_key=True, index=True)
    license_plate = Column(String, unique=True, nullable=True)
    type = Column(Enum(VehicleType), nullable=True)
    capacity = Column(Integer, nullable=True)
    status = Column(String, nullable=True, default="active")

    deployments = relationship("Deployment", back_populates="vehicle")


class Driver(Base):
    __tablename__ = "drivers"

    driver_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    phone_number = Column(String, unique=True, nullable=True)

    deployments = relationship("Deployment", back_populates="driver")


class DailyTrip(Base):
    __tablename__ = "daily_trips"

    trip_id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.route_id"), nullable=True)
    display_name = Column(String, nullable=True)
    booking_status_percentage = Column(Float, nullable=True)
    live_status = Column(String, nullable=True)

    route = relationship("Route", back_populates="daily_trips")
    deployments = relationship("Deployment", back_populates="trip")


class Deployment(Base):
    __tablename__ = "deployments"

    deployment_id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("daily_trips.trip_id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.vehicle_id"), nullable=True)
    driver_id = Column(Integer, ForeignKey("drivers.driver_id"), nullable=True)

    trip = relationship("DailyTrip", back_populates="deployments")
    vehicle = relationship("Vehicle", back_populates="deployments")
    driver = relationship("Driver", back_populates="deployments")
