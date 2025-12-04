"""
Tools for Movi AI Assistant
Comprehensive tool collection with page-aware filtering
"""
from langchain.tools import tool
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import sys
import os

# Add backend to path to allow imports
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from models import Vehicle, DailyTrip, Deployment, Stop, Path, Route, Driver, RouteStatus, PathStop
from database import SessionLocal
from crud import (
    stop as stop_crud,
    path as path_crud,
    route as route_crud,
    vehicle as vehicle_crud,
    driver as driver_crud,
    daily_trip as daily_trip_crud,
    deployment as deployment_crud
)
from schemas import StopCreate, PathCreate, RouteCreate, DeploymentCreate, PathStopBase


# ==============================================================================
# STOPS TOOLS
# ==============================================================================

@tool
def list_all_stops() -> str:
    """List all stops in the system with their IDs and coordinates.

    Inputs: None
    """
    db = SessionLocal()
    try:
        stops = stop_crud.get_all_stops(db)
        if not stops:
            return "No stops found in the system."
        
        result = "Available Stops:\n"
        for stop in stops:
            result += f"- {stop.name} (ID: {stop.stop_id}, Lat: {stop.latitude}, Lon: {stop.longitude})\n"
        return result
    finally:
        db.close()


@tool
def get_stop_details(stop_name: str) -> str:
    """Get details about a specific stop by name including ID and coordinates.

    Inputs: stop_name: str
    """
    db = SessionLocal()
    try:
        stop = stop_crud.get_stop_by_name(db, stop_name)
        if not stop:
            return f"Stop '{stop_name}' not found."
        
        return f"Stop: {stop.name}\nID: {stop.stop_id}\nCoordinates: ({stop.latitude}, {stop.longitude})"
    finally:
        db.close()


@tool
def create_new_stop(
    stop_name: Optional[str] = None, 
    latitude: Optional[float] = None, 
    longitude: Optional[float] = None,
    stops: Optional[List[dict]] = None
) -> str:
    """
    Creates one or more new stops in the database.
    
    Usage:
    1. Single stop: provide stop_name, latitude, and longitude.
    2. Multiple stops: provide a list of dicts in 'stops' argument, e.g., stops=[{"name": "Stop A", "latitude": 12.3, "longitude": 77.1}, ...]
    """
    db: Session = SessionLocal()
    created_stops = []
    errors = []

    # Helper function to create a single stop
    def _create_single(name, lat, lon):
        existing_stop = db.query(Stop).filter(Stop.name == name).first()
        if existing_stop:
            return f"Stop '{name}' already exists (ID: {existing_stop.stop_id})"
        
        new_stop = Stop(name=name, latitude=lat, longitude=lon)
        db.add(new_stop)
        # Flush to get ID but don't commit yet if doing bulk
        db.flush() 
        db.refresh(new_stop)
        return f"Created '{new_stop.name}' (ID: {new_stop.stop_id})"

    try:
        # Case 1: Multiple stops provided
        if stops:
            for s in stops:
                # Handle keys: 'name' or 'stop_name'
                s_name = s.get("name") or s.get("stop_name")
                s_lat = s.get("latitude")
                s_lon = s.get("longitude")
                
                if s_name and s_lat is not None and s_lon is not None:
                    result = _create_single(s_name, s_lat, s_lon)
                    created_stops.append(result)
                else:
                    errors.append(f"Invalid data for stop: {s}")
            
            db.commit()
            return "\n".join(created_stops + errors)

        # Case 2: Single stop provided
        elif stop_name and latitude is not None and longitude is not None:
            result = _create_single(stop_name, latitude, longitude)
            db.commit()
            return result

        else:
            return "Error: Must provide either (stop_name, latitude, longitude) OR a list of 'stops'."

    except Exception as e:
        db.rollback()
        return f"Error creating stops: {str(e)}"
    finally:
        db.close()


@tool
def update_stop(stop_id: int, name: Optional[str] = None, latitude: Optional[float] = None, longitude: Optional[float] = None) -> str:
    """Update an existing stop's name, latitude, or longitude.
    Inputs: stop_id: int, name: Optional[str], latitude: Optional[float], longitude: Optional[float]"""
    db = SessionLocal()
    try:
        stop = stop_crud.get_stop(db, stop_id)
        if not stop:
            return f"Error: Stop with ID {stop_id} not found."
        
        if name is not None:
            stop.name = name
        if latitude is not None:
            stop.latitude = latitude
        if longitude is not None:
            stop.longitude = longitude
        
        db.commit()
        db.refresh(stop)
        
        return f"Successfully updated stop (ID: {stop_id}): {stop.name} at ({stop.latitude}, {stop.longitude})."
    except Exception as e:
        db.rollback()
        return f"Error updating stop: {str(e)}"
    finally:
        db.close()


# ==============================================================================
# PATHS TOOLS
# ==============================================================================

@tool
def list_all_paths() -> str:
    """List all paths in the system with their IDs and stop count.

    Inputs: None
    """
    db = SessionLocal()
    try:
        paths = path_crud.get_all_paths(db)
        if not paths:
            return "No paths found in the system."
        
        result = "Available Paths:\n"
        for path in paths:
            stop_count = len(path.stops)
            result += f"- {path.path_name} (ID: {path.path_id}, {stop_count} stops)\n"
        return result
    finally:
        db.close()


@tool
def list_stops_for_path(path_name: str) -> str:
    """Returns an ordered list of stop names for a given path name.

    Inputs: path_name: str
    """
    db: Session = SessionLocal()
    path = db.query(Path).filter(Path.path_name == path_name).first()
    if not path:
        db.close()
        return f"Path '{path_name}' not found."
    
    ordered_stops = sorted(path.stops, key=lambda ps: ps.stop_order)
    stop_names = [ps.stop.name for ps in ordered_stops]
    db.close()
    return f"Stops in path '{path_name}': {' → '.join(stop_names)}"


@tool
def create_new_path(path_name: str, stop_names: List[str]) -> str:
    """Creates a new path using an ordered list of existing stop names.

    Inputs: path_name: str, stop_names: List[str]
    """
    db: Session = SessionLocal()
    
    existing_path = db.query(Path).filter(Path.path_name == path_name).first()
    if existing_path:
        db.close()
        return f"Path '{path_name}' already exists."
    
    new_path = Path(path_name=path_name)
    db.add(new_path)
    db.flush()
    
    for idx, stop_name in enumerate(stop_names, start=1):
        stop = db.query(Stop).filter(Stop.name == stop_name).first()
        if not stop:
            db.rollback()
            db.close()
            return f"Stop '{stop_name}' not found. Create it first."
        
        from models import PathStop
        path_stop = PathStop(path_id=new_path.path_id, stop_id=stop.stop_id, stop_order=idx)
        db.add(path_stop)
    
    db.commit()
    db.close()
    return f"Created path '{path_name}' with {len(stop_names)} stops: {' → '.join(stop_names)}"


@tool
def delete_path(path_name: str) -> str:
    """Delete a path by its name. This will also delete all associated PathStop entries.
    Note: If the path is used by any routes, those routes should be deleted first.

    Inputs: path_name: str
    """
    db: Session = SessionLocal()
    try:
        path = db.query(Path).filter(Path.path_name == path_name).first()
        if not path:
            return f"Path '{path_name}' not found."
        
        # Check if path is used by any routes
        routes_using_path = db.query(Route).filter(Route.path_id == path.path_id).all()
        if routes_using_path:
            route_names = [r.route_display_name for r in routes_using_path]
            return f"Cannot delete path '{path_name}' because it is used by {len(routes_using_path)} route(s): {', '.join(route_names)}. Please delete these routes first."
        
        # Delete the path (cascades to PathStop entries via relationship)
        path_id = path.path_id
        db.delete(path)
        db.commit()
        return f"Successfully deleted path '{path_name}' (ID: {path_id})."
    except Exception as e:
        db.rollback()
        return f"Error deleting path: {str(e)}"
    finally:
        db.close()


# ==============================================================================
# ROUTES TOOLS
# ==============================================================================

@tool
def list_all_routes() -> str:
    """List all routes in the system with their paths, status, and capacity.

    Inputs: None
    """
    db = SessionLocal()
    try:
        routes = route_crud.get_all_routes(db)
        if not routes:
            return "No routes found in the system."
        
        result = "Available Routes:\n"
        for route in routes:
            result += f"- {route.route_display_name} | Path: {route.path.path_name} | {route.direction} | Capacity: {route.capacity} | Status: {route.status.value}\n"
        return result
    finally:
        db.close()


@tool
def list_routes_using_path(path_name: str) -> str:
    """List all routes that use a specific path.

    Inputs: path_name: str
    """
    db = SessionLocal()
    try:
        path = path_crud.get_path_by_name(db, path_name)
        if not path:
            return f"Path '{path_name}' not found."
        
        routes = route_crud.get_routes_by_path(db, path.path_id)
        
        if not routes:
            return f"No routes found using path '{path_name}'."
        
        result = f"Routes using {path_name}:\n"
        for route in routes:
            result += f"- {route.route_display_name} ({route.direction}, {route.shift_time}, Status: {route.status.value})\n"
        return result
    finally:
        db.close()


@tool
def find_routes_for_path(path_name: str) -> str:
    """Finds all routes that are based on a specific path name.

    Inputs: path_name: str
    """
    db: Session = SessionLocal()
    path = db.query(Path).filter(Path.path_name == path_name).first()
    if not path:
        db.close()
        return f"Path '{path_name}' not found."
    routes = db.query(Route).filter(Route.path_id == path.path_id).all()
    db.close()
    if not routes:
        return f"No routes found using path '{path_name}'."
    route_names = [r.route_display_name for r in routes]
    return f"Routes using path '{path_name}': {', '.join(route_names)}"


@tool
def create_new_route(
    route_name: str,
    path_name: str,
    shift_time: str,
    direction: str,
    capacity: int,
    status: str = "active"
) -> str:
    """Create a new route on an existing path with shift time, direction, and capacity.

    Inputs: route_name: str, path_name: str, shift_time: str, direction: str, capacity: int, status: str
    """
    db = SessionLocal()
    try:
        # Validate path exists
        path = path_crud.get_path_by_name(db, path_name)
        if not path:
            return f"Error: Path '{path_name}' not found."
        
        # Parse time
        from datetime import datetime
        time_obj = datetime.strptime(shift_time, "%H:%M").time()
        
        route_status = RouteStatus.active if status == "active" else RouteStatus.deactivated
        
        route_data = RouteCreate(
            path_id=path.path_id,
            route_display_name=route_name,
            shift_time=time_obj,
            direction=direction,
            capacity=capacity,
            allocated_waitlist=0,
            status=route_status
        )
        route = route_crud.create_route(db, route_data)
        return f"Successfully created route '{route.route_display_name}' (ID: {route.route_id}) on path '{path_name}' for {shift_time}."
    except Exception as e:
        return f"Error creating route: {str(e)}"
    finally:
        db.close()


@tool
def update_route(
    route_id: int,
    route_display_name: Optional[str] = None,
    capacity: Optional[int] = None,
    status: Optional[str] = None
) -> str:
    """Update an existing route's display name, capacity, or status.

    Inputs: route_id: int, route_display_name: Optional[str], capacity: Optional[int], status: Optional[str]
    """
    db = SessionLocal()
    try:
        route = route_crud.get_route(db, route_id)
        if not route:
            return f"Error: Route with ID {route_id} not found."
        
        if route_display_name is not None:
            route.route_display_name = route_display_name
        if capacity is not None:
            route.capacity = capacity
        if status is not None:
            route.status = RouteStatus.active if status == "active" else RouteStatus.deactivated
        
        db.commit()
        db.refresh(route)
        
        return f"Successfully updated route (ID: {route_id}): {route.route_display_name}, Capacity: {route.capacity}, Status: {route.status.value}."
    except Exception as e:
        db.rollback()
        return f"Error updating route: {str(e)}"
    finally:
        db.close()


# ==============================================================================
# VEHICLES TOOLS
# ==============================================================================

@tool
def list_all_vehicles() -> str:
    """List all vehicles in the system with their license plates, types, capacity, and status.

    Inputs: None
    """
    db = SessionLocal()
    try:
        vehicles = vehicle_crud.get_all_vehicles(db)
        if not vehicles:
            return "No vehicles found in the system."
        
        result = "Available Vehicles:\n"
        for vehicle in vehicles:
            result += f"- {vehicle.license_plate} (ID: {vehicle.vehicle_id}, Type: {vehicle.type.value}, Capacity: {vehicle.capacity}, Status: {vehicle.status})\n"
        return result
    finally:
        db.close()


@tool
def get_unassigned_vehicles() -> str:
    """Returns a list of license plates for vehicles that are not currently assigned to any trip.

    Inputs: None
    """
    db: Session = SessionLocal()
    try:
        assigned_vehicle_ids = [d.vehicle_id for d in db.query(Deployment).all() if d.vehicle_id]
        unassigned_vehicles = db.query(Vehicle).filter(Vehicle.vehicle_id.notin_(assigned_vehicle_ids) if assigned_vehicle_ids else True).all()
        if not unassigned_vehicles:
            return "All vehicles are currently assigned."
        result = "Unassigned vehicles:\n"
        for v in unassigned_vehicles:
            result += f"- {v.license_plate} (Type: {v.type.value if v.type else 'Unknown'}, Capacity: {v.capacity})\n"
        return result
    finally:
        db.close()


# ==============================================================================
# DRIVERS TOOLS
# ==============================================================================

@tool
def list_all_drivers() -> str:
    """List all drivers in the system with their names, phone numbers, and IDs.

    Inputs: None
    """
    db = SessionLocal()
    try:
        drivers = driver_crud.get_all_drivers(db)
        if not drivers:
            return "No drivers found in the system."
        
        result = "Available Drivers:\n"
        for driver in drivers:
            result += f"- {driver.name} (ID: {driver.driver_id}, Phone: {driver.phone_number})\n"
        return result
    finally:
        db.close()


@tool
def get_unassigned_drivers() -> str:
    """Returns a list of drivers that are not currently assigned to any trip.

    Inputs: None
    """
    db: Session = SessionLocal()
    try:
        # Get all assigned driver IDs from deployments
        assigned_driver_ids = [d.driver_id for d in db.query(Deployment).all() if d.driver_id]
        
        # Get all drivers that are NOT in the assigned list
        if assigned_driver_ids:
            unassigned_drivers = db.query(Driver).filter(Driver.driver_id.notin_(assigned_driver_ids)).all()
        else:
            # If no drivers are assigned, all drivers are unassigned
            unassigned_drivers = db.query(Driver).all()
        
        if not unassigned_drivers:
            return "All drivers are currently assigned to trips."
        
        result = "Unassigned drivers:\n"
        for driver in unassigned_drivers:
            result += f"- {driver.name} (ID: {driver.driver_id}, Phone: {driver.phone_number})\n"
        return result
    finally:
        db.close()


# ==============================================================================
# TRIPS TOOLS
# ==============================================================================

@tool
def get_all_trips() -> str:
    """Returns a list of all display names for today's trips.

    Inputs: None
    """
    db: Session = SessionLocal()
    trips = db.query(DailyTrip).all()
    db.close()
    if not trips:
        return "No trips found."
    trip_names = [t.display_name for t in trips]
    return f"Today's trips: {', '.join(trip_names)}"


@tool
def get_trip_status(trip_display_name: str) -> str:
    """Gets the status, booking percentage, and deployment details for a specific trip by its display name."""
    db: Session = SessionLocal()
    try:
        trip = db.query(DailyTrip).filter(DailyTrip.display_name == trip_display_name).first()
        if not trip:
            return f"Trip '{trip_display_name}' not found."
        
        # Get ALL deployments for this trip (same as UI does)
        deployments = deployment_crud.get_deployments_by_trip(db, trip.trip_id)
        
        if deployments:
            # Show all deployments (matching UI behavior)
            deployment_info = "Assignments:\n"
            for dep in deployments:
                vehicle = db.query(Vehicle).get(dep.vehicle_id) if dep.vehicle_id else None
                driver = db.query(Driver).get(dep.driver_id) if dep.driver_id else None
                if vehicle and driver:
                    deployment_info += f"- Vehicle: {vehicle.license_plate}, Driver: {driver.name}\n"
                elif vehicle:
                    deployment_info += f"- Vehicle: {vehicle.license_plate}, Driver: Not assigned\n"
                elif driver:
                    deployment_info += f"- Vehicle: Not assigned, Driver: {driver.name}\n"
        else:
            deployment_info = "No vehicle or driver assigned."
        
        return (
            f"Status of trip '{trip.display_name}':\n"
            f"- Live Status: {trip.live_status}\n"
            f"- Booking: {trip.booking_status_percentage}%\n"
            f"- {deployment_info}"
        )
    finally:
        db.close()


@tool
def get_trip_data(trip_display_name: str) -> str:
    """Get the status and details of a specific trip by display name.

    Inputs: trip_display_name: str
    """
    db = SessionLocal()
    try:
        trip = daily_trip_crud.get_daily_trip_by_display_name(db, trip_display_name)
        if not trip:
            return f"Trip '{trip_display_name}' not found."
        
        result = f"Trip: {trip.display_name}\n"
        result += f"Trip ID: {trip.trip_id}\n"
        result += f"Route: {trip.route.route_display_name}\n"
        result += f"Booking Status: {trip.booking_status_percentage}%\n"
        result += f"Live Status: {trip.live_status}\n"
        
        # Check deployments
        deployments = deployment_crud.get_deployments_by_trip(db, trip.trip_id)
        if deployments:
            result += f"\nAssignments:\n"
            for dep in deployments:
                result += f"- Vehicle: {dep.vehicle.license_plate}\n"
                result += f"- Driver: {dep.driver.name}\n"
        else:
            result += "\nNo vehicle/driver assigned yet.\n"
        
        return result
    finally:
        db.close()


@tool
def create_new_trip(route_display_name: str, trip_display_name: str, live_status: str = "scheduled") -> str:
    """Creates a new daily trip for a given route with a specific display name and status.

    Inputs: route_display_name: str, trip_display_name: str, live_status: str
    """
    db: Session = SessionLocal()
    route = db.query(Route).filter(Route.route_display_name == route_display_name).first()
    if not route:
        db.close()
        return f"Route '{route_display_name}' not found."
    
    existing_trip = db.query(DailyTrip).filter(DailyTrip.display_name == trip_display_name).first()
    if existing_trip:
        db.close()
        return f"Trip '{trip_display_name}' already exists."
    
    new_trip = DailyTrip(route_id=route.route_id, display_name=trip_display_name, live_status=live_status)
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)
    db.close()
    return f"Created trip '{new_trip.display_name}' for route '{route_display_name}' with ID {new_trip.trip_id}."


@tool
def update_trip(
    trip_id: int,
    display_name: Optional[str] = None,
    booking_status_percentage: Optional[float] = None,
    live_status: Optional[str] = None
) -> str:
    """Update an existing trip's display name, booking status, or live status.

    Inputs: trip_id: int, display_name: Optional[str], booking_status_percentage: Optional[float], live_status: Optional[str]
    """
    db = SessionLocal()
    try:
        trip = daily_trip_crud.get_daily_trip_by_id(db, trip_id)
        if not trip:
            return f"Error: Trip with ID {trip_id} not found."
        
        if display_name is not None:
            trip.display_name = display_name
        if booking_status_percentage is not None:
            trip.booking_status_percentage = booking_status_percentage
        if live_status is not None:
            trip.live_status = live_status
        
        db.commit()
        db.refresh(trip)
        
        return f"Successfully updated trip (ID: {trip_id}): {trip.display_name}, Booking: {trip.booking_status_percentage}%, Status: {trip.live_status}."
    except Exception as e:
        db.rollback()
        return f"Error updating trip: {str(e)}"
    finally:
        db.close()


@tool
def delete_trip(trip_display_name: str) -> str:
    """Delete a trip by trip display name (deployments must be removed first). Just provide the trip display name.

    Inputs: trip_display_name: str
    """
    db = SessionLocal()
    try:
        trip = daily_trip_crud.get_daily_trip_by_display_name(db, trip_display_name)
        if not trip:
            return f"Error: Trip '{trip_display_name}' not found."
        
        trip_name = trip.display_name
        booking_pct = trip.booking_status_percentage
        
        deployments = deployment_crud.get_deployments_by_trip(db, trip.trip_id)
        if deployments:
            #remove the deployments first
            for dep in deployments:
                deployment_crud.delete_deployment(db, dep.deployment_id)
        
        daily_trip_crud.delete_daily_trip(db, trip.trip_id)
        
        success_msg = f"Successfully deleted trip '{trip_name}' (ID: {trip.trip_id})."
        if booking_pct > 0:
            success_msg += f" Note: This trip had {booking_pct}% bookings."
        
        return success_msg
    except Exception as e:
        return f"Error deleting trip: {str(e)}"
    finally:
        db.close()


# ==============================================================================
# DEPLOYMENT TOOLS
# ==============================================================================

@tool
def assign_vehicle_and_driver_to_trip(
    trip_display_name: str,
    vehicle_license_plate: str,
    driver_name: str
) -> str:
    """Assign a vehicle and driver to a trip.

    Inputs: trip_display_name: str, vehicle_license_plate: str, driver_name: str
    """
    db = SessionLocal()
    try:
        # Get trip
        trip = daily_trip_crud.get_daily_trip_by_display_name(db, trip_display_name)
        if not trip:
            return f"Error: Trip '{trip_display_name}' not found."
        
        # Get vehicle
        vehicle = vehicle_crud.get_vehicle_by_license_plate(db, vehicle_license_plate)
        if not vehicle:
            return f"Error: Vehicle '{vehicle_license_plate}' not found."
        
        # Get driver
        driver = driver_crud.get_driver_by_name(db, driver_name)
        if not driver:
            return f"Error: Driver '{driver_name}' not found."
        
        # Create deployment
        deployment_data = DeploymentCreate(
            trip_id=trip.trip_id,
            vehicle_id=vehicle.vehicle_id,
            driver_id=driver.driver_id
        )
        deployment = deployment_crud.create_deployment(db, deployment_data)
        
        return f"Successfully assigned vehicle '{vehicle_license_plate}' and driver '{driver_name}' to trip '{trip_display_name}'."
    except Exception as e:
        return f"Error creating deployment: {str(e)}"
    finally:
        db.close()


@tool
def remove_vehicle_from_trip(trip_display_name: str) -> str:
    """Removes the assigned vehicle and driver from a specific trip.
    If multiple deployments exist, removes all of them.

    Inputs: trip_display_name: str
    """
    db: Session = SessionLocal()
    try:
        trip = db.query(DailyTrip).filter(DailyTrip.display_name == trip_display_name).first()
        if not trip:
            return f"Trip '{trip_display_name}' not found."
        
        # Get ALL deployments for this trip (same as UI does)
        deployments = deployment_crud.get_deployments_by_trip(db, trip.trip_id)
        if not deployments:
            return f"No vehicle assigned to trip '{trip_display_name}'."
        
        # Remove all deployments for this trip
        count = len(deployments)
        for deployment in deployments:
            db.delete(deployment)
        
        db.commit()
        
        if count == 1:
            return f"Successfully removed vehicle and driver from trip '{trip_display_name}'. Bookings may be affected."
        else:
            return f"Successfully removed {count} vehicle(s) and driver(s) from trip '{trip_display_name}'. Bookings may be affected."
    except Exception as e:
        db.rollback()
        return f"Error removing vehicle from trip: {str(e)}"
    finally:
        db.close()


@tool
def delete_deployment(deployment_id: int) -> str:
    """Delete a specific deployment by ID to remove vehicle and driver assignment from a trip.

    Inputs: deployment_id: int
    """
    db = SessionLocal()
    try:
        deployment = deployment_crud.get_deployment_by_id(db, deployment_id)
        if not deployment:
            return f"Error: Deployment with ID {deployment_id} not found."
        
        # Get details before deletion
        vehicle_plate = deployment.vehicle.license_plate if deployment.vehicle else "Unknown"
        
        # Delete deployment
        deployment_crud.delete_deployment(db, deployment_id)
        
        return f"Successfully deleted deployment (ID: {deployment_id}). Vehicle {vehicle_plate} is now unassigned from trip."
    except Exception as e:
        return f"Error deleting deployment: {str(e)}"
    finally:
        db.close()


# ==============================================================================
# CONSEQUENCE CHECKING (Internal helpers)
# ==============================================================================

def check_trip_consequences(trip_display_name: str, db: Session) -> dict:
    trip = db.query(DailyTrip).filter(DailyTrip.display_name == trip_display_name).first()
    if not trip:
        return {"has_consequences": False}  # Trip doesn't exist
    
    # Always require confirmation for vehicle removal, even with 0% bookings
    if trip.booking_status_percentage == 0:
        return {
            "has_consequences": True,
            "details": f"You are about to remove the vehicle from trip '{trip_display_name}'. This trip currently has no bookings."
        }
    else:
        return {
            "has_consequences": True,
            "details": f"The trip '{trip_display_name}' is already {trip.booking_status_percentage}% booked by employees."
        }


def check_path_deletion_consequences(path_name: str, db: Session) -> dict:
    """Check consequences of deleting a path."""
    path = db.query(Path).filter(Path.path_name == path_name).first()
    if not path:
        return {"has_consequences": False}  # Path doesn't exist
    
    # Check if path is used by any routes
    routes = db.query(Route).filter(Route.path_id == path.path_id).all()
    if routes:
        route_names = [r.route_display_name for r in routes]
        return {
            "has_consequences": True,
            "details": f"Path '{path_name}' is currently used by {len(routes)} route(s): {', '.join(route_names)}. Deleting this path will break these routes. Please delete the routes first or reassign them to different paths."
        }
    
    # Check if path has stops (it should, but let's verify)
    path_stops = db.query(PathStop).filter(PathStop.path_id == path.path_id).all()
    if path_stops:
        return {
            "has_consequences": True,
            "details": f"Path '{path_name}' contains {len(path_stops)} stop(s). Deleting this path will remove all stop associations. This action cannot be undone."
        }
    
    # No major consequences, but still require confirmation
    return {
        "has_consequences": True,
        "details": f"You are about to delete path '{path_name}'. This action cannot be undone."
    }


def check_route_deactivation_consequences(route_display_name: str, db: Session) -> dict:
    route = db.query(Route).filter(Route.route_display_name == route_display_name).first()
    if not route:
        return {"has_consequences": False}
    
    trips = db.query(DailyTrip).filter(DailyTrip.route_id == route.route_id).all()
    if not trips:
        return {"has_consequences": False}
    
    booked_trips = [t for t in trips if t.booking_status_percentage > 0]
    if booked_trips:
        total_bookings = sum(t.booking_status_percentage for t in booked_trips)
        return {
            "has_consequences": True,
            "details": f"Route '{route_display_name}' has {len(booked_trips)} active trips with bookings (total: {total_bookings}%)."
        }
    
    return {
        "has_consequences": True,
        "details": f"Route '{route_display_name}' has {len(trips)} active trips but no bookings yet."
    }


# ==============================================================================
# TOOL CATEGORIES - PAGE-BASED FILTERING
# ==============================================================================

# Bus Dashboard page tools (trips, vehicles, drivers, deployments)
BUS_DASHBOARD_TOOLS = [
    get_all_trips,
    get_trip_status,
    get_trip_data,
    create_new_trip,
    update_trip,
    delete_trip,
    assign_vehicle_and_driver_to_trip,
    remove_vehicle_from_trip,
    delete_deployment,
    list_all_vehicles,
    get_unassigned_vehicles,
    list_all_drivers,
    get_unassigned_drivers,
]

# Stops & Paths page tools
STOPS_PATHS_TOOLS = [
    list_all_stops,
    get_stop_details,
    create_new_stop,
    update_stop,
    list_all_paths,
    list_stops_for_path,
    create_new_path,
    delete_path,
]

# Routes page tools
ROUTES_TOOLS = [
    list_all_routes,
    list_routes_using_path,
    find_routes_for_path,
    create_new_route,
    update_route,
]

# Export all tools as a list for backward compatibility
ALL_TOOLS = BUS_DASHBOARD_TOOLS + STOPS_PATHS_TOOLS + ROUTES_TOOLS


def get_tools_for_page(page: str) -> list:
    """
    Get tools available for a specific page context.
    This enables page-aware tool filtering for better agent performance.
    
    Args:
        page: Page context (busDashboard, stops_paths, routes, vehicles, drivers, unknown)
    
    Returns:
        List of tools available for that page
    """
    page_tools = {
        "busDashboard": BUS_DASHBOARD_TOOLS,
        "stops_paths": STOPS_PATHS_TOOLS,
        "routes": ROUTES_TOOLS,
        "vehicles": BUS_DASHBOARD_TOOLS,  # Vehicles are part of bus dashboard
        "drivers": BUS_DASHBOARD_TOOLS,   # Drivers are part of bus dashboard
        "unknown": BUS_DASHBOARD_TOOLS,   # Default to bus dashboard
    }
    
    tools = page_tools.get(page, BUS_DASHBOARD_TOOLS)
    
    return tools