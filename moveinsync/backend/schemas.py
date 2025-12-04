from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import time
from enum import Enum


# ----------------------------
# ENUMS
# ----------------------------
class RouteStatus(str, Enum):
    active = "active"
    deactivated = "deactivated"


class VehicleType(str, Enum):
    bus = "bus"
    cab = "cab"


# ----------------------------
# STATIC ASSETS
# ----------------------------

class StopBase(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class StopCreate(BaseModel):
    name: str
    latitude: float
    longitude: float


class StopUpdate(StopBase):
    pass


class StopResponse(StopBase):
    stop_id: int

    class Config:
        orm_mode = True


class PathStopBase(BaseModel):
    stop_id: int
    stop_order: int


class PathBase(BaseModel):
    path_name: Optional[str] = None
    stops: Optional[List[PathStopBase]] = None


class PathCreate(BaseModel):
    path_name: str
    stops: List[PathStopBase]


class PathUpdate(PathBase):
    pass


class PathResponse(BaseModel):
    path_id: int
    path_name: str
    stops: List[PathStopBase]

    class Config:
        from_attributes = True


class RouteBase(BaseModel):
    path_id: Optional[int] = None
    route_display_name: Optional[str] = None
    shift_time: Optional[time] = None
    direction: Optional[str] = None
    start_point: Optional[str] = None
    end_point: Optional[str] = None
    capacity: Optional[int] = None
    allocated_waitlist: Optional[int] = None
    status: Optional[RouteStatus] = None


class RouteCreate(BaseModel):
    path_id: int
    route_display_name: str
    shift_time: time
    direction: str
    start_point: Optional[str] = None
    end_point: Optional[str] = None
    capacity: int
    allocated_waitlist: int = 0
    status: RouteStatus = RouteStatus.active


class RouteUpdate(RouteBase):
    pass


class RouteResponse(BaseModel):
    route_id: int
    path_id: Optional[int] = None
    route_display_name: str
    shift_time: time
    direction: str
    start_point: Optional[str] = None
    end_point: Optional[str] = None
    capacity: int
    allocated_waitlist: int
    status: RouteStatus

    class Config:
        orm_mode = True


# ----------------------------
# DYNAMIC ASSETS
# ----------------------------

class VehicleBase(BaseModel):
    license_plate: Optional[str] = None
    type: Optional[VehicleType] = None
    capacity: Optional[int] = None
    status: Optional[str] = None


class VehicleCreate(BaseModel):
    license_plate: str
    type: VehicleType
    capacity: int
    status: str = "active"


class VehicleUpdate(VehicleBase):
    pass


class VehicleResponse(VehicleBase):
    vehicle_id: int

    class Config:
        orm_mode = True


class DriverBase(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None


class DriverCreate(BaseModel):
    name: str
    phone_number: str


class DriverUpdate(DriverBase):
    pass


class DriverResponse(DriverBase):
    driver_id: int

    class Config:
        orm_mode = True


class DailyTripBase(BaseModel):
    route_id: Optional[int] = None
    display_name: Optional[str] = None
    booking_status_percentage: Optional[float] = None
    live_status: Optional[str] = None


class DailyTripCreate(BaseModel):
    route_id: int
    display_name: str
    booking_status_percentage: float = 0.0
    live_status: str = "scheduled"


class DailyTripUpdate(DailyTripBase):
    pass


class DailyTripResponse(DailyTripBase):
    trip_id: int

    class Config:
        orm_mode = True


class DeploymentBase(BaseModel):
    trip_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    driver_id: Optional[int] = None


class DeploymentCreate(BaseModel):
    trip_id: int
    vehicle_id: int
    driver_id: int


class DeploymentUpdate(DeploymentBase):
    pass


class DeploymentResponse(DeploymentBase):
    deployment_id: int

    class Config:
        orm_mode = True
