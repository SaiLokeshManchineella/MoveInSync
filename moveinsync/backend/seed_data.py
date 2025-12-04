"""
Seed script to populate the database with sample data
"""
from database import SessionLocal, engine
from models import Base, Stop, Path, PathStop, Route, Vehicle, Driver, DailyTrip, Deployment, RouteStatus, VehicleType
from datetime import time

# Create all tables
Base.metadata.create_all(bind=engine)

def seed_database():
    db = SessionLocal()
    
    try:
        # Clear existing data (optional - comment out if you want to keep existing data)
        db.query(Deployment).delete()
        db.query(DailyTrip).delete()
        db.query(Route).delete()
        db.query(PathStop).delete()
        db.query(Path).delete()
        db.query(Stop).delete()
        db.query(Driver).delete()
        db.query(Vehicle).delete()
        db.commit()
        
        # Create Stops
        stops_data = [
            {"name": "Downtown Station", "latitude": 12.9716, "longitude": 77.5946},
            {"name": "City Center", "latitude": 12.9352, "longitude": 77.6245},
            {"name": "Tech Park", "latitude": 12.9141, "longitude": 77.6412},
            {"name": "Airport Terminal", "latitude": 13.1986, "longitude": 77.7066},
            {"name": "University Campus", "latitude": 12.9352, "longitude": 77.5665},
            {"name": "Shopping Mall", "latitude": 12.9716, "longitude": 77.6098},
        ]
        
        stops = []
        for stop_data in stops_data:
            stop = Stop(**stop_data)
            db.add(stop)
            stops.append(stop)
        
        db.commit()
        print(f"✓ Created {len(stops)} stops")
        
        # Create Path
        path = Path(path_name="Main Route Path")
        db.add(path)
        db.commit()
        db.refresh(path)
        print(f"✓ Created path: {path.path_name}")
        
        # Create PathStops (ordered stops in the path)
        path_stops_data = [
            {"stop": stops[0], "order": 1},  # Downtown Station
            {"stop": stops[1], "order": 2},  # City Center
            {"stop": stops[2], "order": 3},  # Tech Park
            {"stop": stops[3], "order": 4},  # Airport Terminal
        ]
        
        for ps_data in path_stops_data:
            path_stop = PathStop(
                path_id=path.path_id,
                stop_id=ps_data["stop"].stop_id,
                stop_order=ps_data["order"]
            )
            db.add(path_stop)
        
        db.commit()
        print(f"✓ Created {len(path_stops_data)} path stops")
        
        # Create Route
        route = Route(
            path_id=path.path_id,
            route_display_name="Downtown to Airport Express",
            shift_time=time(8, 0),  # 8:00 AM
            direction="North",
            start_point="Downtown Station",
            end_point="Airport Terminal",
            status=RouteStatus.active,
            capacity=50,
            allocated_waitlist=5
        )
        db.add(route)
        db.commit()
        db.refresh(route)
        print(f"✓ Created route: {route.route_display_name}")
        
        # Create Vehicles
        vehicles_data = [
            {"license_plate": "KA-01-AB-1234", "type": VehicleType.bus, "capacity": 50, "status": "active"},
            {"license_plate": "KA-01-CD-5678", "type": VehicleType.bus, "capacity": 40, "status": "active"},
            {"license_plate": "KA-01-EF-9012", "type": VehicleType.bus, "capacity": 35, "status": "active"},
            {"license_plate": "KA-01-GH-3456", "type": VehicleType.cab, "capacity": 4, "status": "active"},
            {"license_plate": "KA-01-IJ-7890", "type": VehicleType.cab, "capacity": 4, "status": "active"},
        ]
        
        vehicles = []
        for vehicle_data in vehicles_data:
            vehicle = Vehicle(**vehicle_data)
            db.add(vehicle)
            vehicles.append(vehicle)
        
        db.commit()
        print(f"✓ Created {len(vehicles)} vehicles")
        
        # Create Drivers
        drivers_data = [
            {"name": "Rajesh Kumar", "phone_number": "+91-9876543210"},
            {"name": "Suresh Reddy", "phone_number": "+91-9876543211"},
            {"name": "Priya Sharma", "phone_number": "+91-9876543212"},
            {"name": "Amit Patel", "phone_number": "+91-9876543213"},
            {"name": "Kavita Singh", "phone_number": "+91-9876543214"},
        ]
        
        drivers = []
        for driver_data in drivers_data:
            driver = Driver(**driver_data)
            db.add(driver)
            drivers.append(driver)
        
        db.commit()
        print(f"✓ Created {len(drivers)} drivers")
        
        # Create Daily Trips
        trips_data = [
            {"route_id": route.route_id, "display_name": "Morning Express", "booking_status_percentage": 75.5, "live_status": "scheduled"},
            {"route_id": route.route_id, "display_name": "Afternoon Service", "booking_status_percentage": 45.0, "live_status": "in_progress"},
            {"route_id": route.route_id, "display_name": "Evening Commute", "booking_status_percentage": 90.0, "live_status": "scheduled"},
            {"route_id": route.route_id, "display_name": "Night Service", "booking_status_percentage": 30.0, "live_status": "scheduled"},
        ]
        
        trips = []
        for trip_data in trips_data:
            trip = DailyTrip(**trip_data)
            db.add(trip)
            trips.append(trip)
        
        db.commit()
        print(f"✓ Created {len(trips)} trips")
        
        # Create Deployments (assign vehicles and drivers to trips)
        deployments_data = [
            {"trip_id": trips[0].trip_id, "vehicle_id": vehicles[0].vehicle_id, "driver_id": drivers[0].driver_id},
            {"trip_id": trips[1].trip_id, "vehicle_id": vehicles[1].vehicle_id, "driver_id": drivers[1].driver_id},
            {"trip_id": trips[2].trip_id, "vehicle_id": vehicles[2].vehicle_id, "driver_id": drivers[2].driver_id},
        ]
        
        for deployment_data in deployments_data:
            deployment = Deployment(**deployment_data)
            db.add(deployment)
        
        db.commit()
        print(f"✓ Created {len(deployments_data)} deployments")
        
        print("\n✅ Database seeded successfully!")
        print(f"\nSummary:")
        print(f"  - Stops: {len(stops)}")
        print(f"  - Paths: 1")
        print(f"  - Routes: 1")
        print(f"  - Vehicles: {len(vehicles)}")
        print(f"  - Drivers: {len(drivers)}")
        print(f"  - Trips: {len(trips)}")
        print(f"  - Deployments: {len(deployments_data)}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()





