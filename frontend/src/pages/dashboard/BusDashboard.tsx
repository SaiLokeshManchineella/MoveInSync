import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, MapPin, FileText, Link2, Plus, Loader2, Car, Bus, MapIcon, UserCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { AssignVehicleModal } from "@/components/modals/AssignVehicleModal";
import { CreateTripModal } from "@/components/modals/CreateTripModal";
import { EditTripModal } from "@/components/modals/EditTripModal";
import { RouteMap } from "@/components/map/RouteMap";
import { useToast } from "@/hooks/use-toast";
import type { Route, Vehicle, Driver, DailyTrip, DailyTripCreate, Deployment, DeploymentCreate, Stop, Path } from "@/types";

const API_URL = import.meta.env.VITE_API_URL;

export default function BusDashboard() {
  const [trips, setTrips] = useState<DailyTrip[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<DailyTrip | null>(null);
  const [selectedTripRoute, setSelectedTripRoute] = useState<Route | null>(null);
  const [selectedTripStops, setSelectedTripStops] = useState<Stop[]>([]);
  const [selectedTripDeployments, setSelectedTripDeployments] = useState<Deployment[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [createTripModalOpen, setCreateTripModalOpen] = useState(false);
  const [editTripModalOpen, setEditTripModalOpen] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMap, setLoadingMap] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (selectedTrip) {
      fetchTripDeployments(selectedTrip.trip_id);
      fetchAvailableResources(selectedTrip.trip_id);
      fetchTripRouteAndStops(selectedTrip.route_id);
    }
  }, [selectedTrip]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTrips(),
        fetchRoutes(),
        fetchVehicles(),
        fetchDrivers(),
        fetchDeployments(),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrips = async () => {
    try {
      const response = await fetch(`${API_URL}/trips/all`);
      if (response.ok) {
        const data = await response.json();
        setTrips(data);
        if (data.length > 0 && !selectedTrip) {
          setSelectedTrip(data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching trips:", error);
    }
  };

  const fetchDeployments = async () => {
    try {
      const response = await fetch(`${API_URL}/deployments/all`);
      if (response.ok) {
        const data = await response.json();
        setDeployments(data);
      }
    } catch (error) {
      console.error("Error fetching deployments:", error);
    }
  };

  const fetchTripDeployments = async (tripId: number) => {
    try {
      const response = await fetch(`${API_URL}/deployments/trip/${tripId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTripDeployments(data);
      }
    } catch (error) {
      console.error("Error fetching trip deployments:", error);
    }
  };

  const fetchAvailableResources = async (tripId: number) => {
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        fetch(`${API_URL}/deployments/trip/${tripId}/available-vehicles`),
        fetch(`${API_URL}/deployments/trip/${tripId}/available-drivers`),
      ]);
      
      if (vehiclesRes.ok) {
        const vehiclesData = await vehiclesRes.json();
        setAvailableVehicles(vehiclesData);
      }
      
      if (driversRes.ok) {
        const driversData = await driversRes.json();
        setAvailableDrivers(driversData);
      }
    } catch (error) {
      console.error("Error fetching available resources:", error);
    }
  };

  const fetchTripRouteAndStops = async (routeId: number) => {
    setLoadingMap(true);
    try {
      // Fetch route details
      const routeResponse = await fetch(`${API_URL}/routes/${routeId}`);
      if (routeResponse.ok) {
        const routeData = await routeResponse.json();
        setSelectedTripRoute(routeData);

        // Fetch path with stops
        const pathResponse = await fetch(`${API_URL}/paths/${routeData.path_id}`);
        if (pathResponse.ok) {
          const pathData: Path = await pathResponse.json();
          
          // Fetch all stop details
          const stopPromises = pathData.stops
            .sort((a, b) => a.stop_order - b.stop_order)
            .map((pathStop) => 
              fetch(`${API_URL}/stops/${pathStop.stop_id}`).then(res => res.json())
            );
          
          const stopsData = await Promise.all(stopPromises);
          setSelectedTripStops(stopsData);
        }
      }
    } catch (error) {
      console.error("Error fetching route and stops:", error);
      toast({
        title: "Error",
        description: "Failed to load route map",
        variant: "destructive",
      });
    } finally {
      setLoadingMap(false);
    }
  };

  const fetchRoutes = async () => {
    try {
      const response = await fetch(`${API_URL}/routes/all`);
      if (response.ok) {
        const data = await response.json();
        setRoutes(data);
      }
    } catch (error) {
      console.error("Error fetching routes:", error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await fetch(`${API_URL}/vehicles/all`);
      if (response.ok) {
        const data = await response.json();
        setVehicles(data);
      }
    } catch (error) {
      console.error("Error fetching vehicles:", error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await fetch(`${API_URL}/drivers/all`);
      if (response.ok) {
        const data = await response.json();
        setDrivers(data);
      }
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  const handleAssignVehicle = async (data: DeploymentCreate) => {
    try {
      const response = await fetch(`${API_URL}/deployments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to assign vehicle");
      }

      toast({ title: "Vehicle and driver assigned successfully!" });
      setAssignModalOpen(false);
      
      // Refresh deployments
      fetchDeployments();
      if (selectedTrip) {
        fetchTripDeployments(selectedTrip.trip_id);
        fetchAvailableResources(selectedTrip.trip_id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign vehicle",
        variant: "destructive",
      });
    }
  };

  const handleCreateTrip = async (data: DailyTripCreate) => {
    try {
      const response = await fetch(`${API_URL}/trips/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create trip");
      }

      const newTrip = await response.json();
        setTrips([newTrip, ...trips]);
      toast({ 
        title: "Trip created successfully!",
        description: `${data.display_name} has been added to today's schedule.`
      });
      setCreateTripModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create trip",
        variant: "destructive",
      });
    }
  };

  const handleEditTrip = async (data: DailyTripCreate) => {
    if (!selectedTrip) return;

    try {
      const response = await fetch(`${API_URL}/trips/${selectedTrip.trip_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update trip");
      }

      const updatedTrip = await response.json();
        setTrips(trips.map(t => t.trip_id === updatedTrip.trip_id ? updatedTrip : t));
      setSelectedTrip(updatedTrip);
      toast({ 
        title: "Trip updated successfully!",
        description: `${data.display_name} has been updated.`
      });
      setEditTripModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update trip",
        variant: "destructive",
      });
    }
  };

  // Filter trips based on search
  const filteredTrips = trips.filter((trip) =>
    trip.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.trip_id.toString().includes(searchTerm)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "success";
      case "in_progress":
      case "in-progress":
        return "warning";
      case "completed":
        return "muted";
      case "cancelled":
        return "destructive";
      default:
        return "muted";
    }
  };

  // Debug: Log when component renders
  useEffect(() => {
    console.log("BusDashboard component mounted");
  }, []);

  return (
    <>
    <DashboardLayout>
      {/* Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Trips</p>
              <p className="text-2xl font-bold text-foreground">{trips.length}</p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Bus className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-success/5 to-teal-500/5 border-success/20 hover-lift animate-fadeIn" style={{ animationDelay: "50ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Active Routes</p>
              <p className="text-2xl font-bold text-foreground gradient-text">{routes.filter(r => r.status === 'active').length}</p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: "0.5s" }}>
              <MapIcon className="w-6 h-6 text-success" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-warning/5 to-orange-500/5 border-warning/20 hover-lift animate-fadeIn" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">In Progress</p>
              <p className="text-2xl font-bold text-foreground gradient-text">{trips.filter(t => t.status === 'in_progress').length}</p>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: "1s" }}>
              <Calendar className="w-6 h-6 text-warning" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-gradient-to-br from-accent/5 to-cyan-500/5 border-accent/20 hover-lift animate-fadeIn" style={{ animationDelay: "150ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Vehicles</p>
              <p className="text-2xl font-bold text-foreground gradient-text">{vehicles.length}</p>
            </div>
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: "1.5s" }}>
              <Car className="w-6 h-6 text-accent" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content - Vertical Stack Layout */}
      <div className="space-y-6">
        {/* Trip List Section */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Trip Schedule</h2>
              <p className="text-sm text-muted-foreground">Manage and monitor all scheduled trips</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Input 
                placeholder="Search trips..." 
                className="max-w-xs" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select className="px-4 py-2 border border-border rounded-xl bg-background text-sm">
                <option>All Routes</option>
                {routes.map((route) => (
                  <option key={route.route_id} value={route.route_id}>
                    {route.route_display_name}
                  </option>
                ))}
              </select>
              <Button 
                className="gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-md rounded-xl"
                onClick={() => setCreateTripModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                New Trip
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full">
                <SkeletonList count={6} />
              </div>
            ) : filteredTrips.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon={searchTerm ? FileText : Bus}
                  title={searchTerm ? "No trips found" : "No trips available"}
                  description={searchTerm 
                    ? `No trips match "${searchTerm}". Try adjusting your search terms.`
                    : "Get started by creating your first trip. Click the button above to add a new trip."
                  }
                  action={!searchTerm ? {
                    label: "Create New Trip",
                    onClick: () => setCreateTripModalOpen(true)
                  } : undefined}
                />
              </div>
            ) : (
              filteredTrips.map((trip) => (
                <Card
                  key={trip.trip_id}
                  onClick={() => setSelectedTrip(trip)}
                  className={cn(
                    "p-5 cursor-pointer hover-lift animate-fadeIn",
                    selectedTrip?.trip_id === trip.trip_id && "ring-2 ring-primary bg-primary/5 shadow-lg"
                  )}
                  style={{ animationDelay: `${(filteredTrips.indexOf(trip) % 6) * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-foreground mb-1">{trip.display_name || "Unnamed Trip"}</h4>
                      <div className="space-y-2 mb-2">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>ID: {trip.trip_id}</span>
                          <span>•</span>
                          <span className="text-primary font-medium">{trip.booking_status_percentage?.toFixed(0) || 0}% booked</span>
                        </div>
                        <ProgressBar
                          value={trip.booking_status_percentage || 0}
                          max={100}
                          color="primary"
                          showLabel={false}
                          className="h-2"
                        />
                      </div>
                    </div>
                    <StatusBadge
                      status={
                        trip.live_status === "scheduled" ? "success" :
                        trip.live_status === "in_progress" || trip.live_status === "in-progress" ? "in_progress" :
                        trip.live_status === "completed" ? "info" :
                        trip.live_status === "cancelled" ? "error" :
                        "pending"
                      }
                      label={trip.live_status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                      animated={trip.live_status === "in_progress" || trip.live_status === "in-progress"}
                    />
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>

        {/* Trip Details Panel - Now appears below trip list */}
        {selectedTrip && (
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">{selectedTrip.display_name}</h2>
                <p className="text-sm text-muted-foreground">Trip ID: {selectedTrip.trip_id} • Route ID: {selectedTrip.route_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditTripModalOpen(true)}
                  className="rounded-xl"
                >
                  Edit Trip
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAssignModalOpen(true)}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 rounded-xl shadow-md"
                >
                  Assign Vehicle
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4 text-center bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 hover-lift animate-scaleIn">
                <div className="text-2xl font-bold text-foreground mb-1 gradient-text">
                  {selectedTripDeployments.length}
                </div>
                <div className="text-xs text-muted-foreground">Assigned</div>
              </Card>
              <Card className="p-4 text-center bg-gradient-to-br from-success/5 to-teal-500/5 border-success/20 hover-lift animate-scaleIn" style={{ animationDelay: "50ms" }}>
                <div className="text-2xl font-bold text-foreground mb-1 gradient-text">
                  {selectedTrip.booking_status_percentage?.toFixed(0) || 0}%
                </div>
                <div className="text-xs text-muted-foreground">Booked</div>
                <ProgressBar
                  value={selectedTrip.booking_status_percentage || 0}
                  max={100}
                  color="success"
                  showLabel={false}
                  className="mt-2 h-2"
                />
              </Card>
              <Card className="p-4 text-center bg-gradient-to-br from-accent/5 to-cyan-500/5 border-accent/20 hover-lift animate-scaleIn" style={{ animationDelay: "100ms" }}>
                <div className="text-2xl font-bold text-foreground mb-1 gradient-text">
                  {availableVehicles.length}
                </div>
                <div className="text-xs text-muted-foreground">Available</div>
              </Card>
              <Card className="p-4 text-center bg-gradient-to-br from-warning/5 to-orange-500/5 border-warning/20 hover-lift animate-scaleIn" style={{ animationDelay: "150ms" }}>
                <div className="text-sm font-semibold mb-1 flex justify-center">
                  <StatusBadge
                    status={
                      selectedTrip.live_status === "scheduled" ? "success" :
                      selectedTrip.live_status === "in_progress" || selectedTrip.live_status === "in-progress" ? "in_progress" :
                      selectedTrip.live_status === "completed" ? "info" :
                      selectedTrip.live_status === "cancelled" ? "error" :
                      "pending"
                    }
                    label={selectedTrip.live_status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                    animated={selectedTrip.live_status === "in_progress" || selectedTrip.live_status === "in-progress"}
                  />
                </div>
                <div className="text-xs text-muted-foreground">Status</div>
              </Card>
            </div>

            {/* Route Map Section */}
            <div className="mt-6">
              <h3 className="text-lg font-bold text-foreground mb-4">Route Visualization</h3>
              {loadingMap ? (
                <Card className="bg-muted/30 rounded-2xl h-96 flex items-center justify-center border border-border/50">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-primary mx-auto mb-2 animate-spin" />
                    <p className="text-muted-foreground">Loading route map...</p>
                  </div>
                </Card>
              ) : selectedTripStops.length > 0 ? (
                <Card className="p-0 overflow-hidden rounded-2xl border border-border/50">
                  <RouteMap
                    stops={selectedTripStops}
                    routeName={selectedTripRoute?.route_display_name}
                    className="h-96"
                  />
                </Card>
              ) : (
                <EmptyState
                  icon={MapPin}
                  title="No route data"
                  description="Route information is not available for this trip. Please check the route configuration."
                />
              )}
            </div>

            {/* Deployments List or Empty State */}
            {selectedTripDeployments.length === 0 ? (
              <EmptyState
                icon={Car}
                title="No vehicles assigned"
                description="Assign a vehicle and driver to this trip to get started. You can assign multiple vehicles if needed."
                action={{
                  label: "Assign Vehicle & Driver",
                  onClick: () => {
                    if (selectedTrip) {
                      setAssignModalOpen(true);
                    }
                  }
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between mb-4 md:col-span-2">
                  <h3 className="text-lg font-bold text-foreground">Vehicle Assignments ({selectedTripDeployments.length})</h3>
                  <Button 
                    size="sm"
                    onClick={() => setAssignModalOpen(true)}
                    className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 rounded-xl shadow-md"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Assignment
                  </Button>
                </div>
                {selectedTripDeployments.map((deployment) => {
                  const vehicle = vehicles.find(v => v.vehicle_id === deployment.vehicle_id);
                  const driver = drivers.find(d => d.driver_id === deployment.driver_id);
                  return (
                    <Card key={deployment.deployment_id} className="p-5 hover-lift animate-fadeIn">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                              <Car className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{vehicle?.license_plate || "Unknown"}</p>
                              <p className="text-sm text-muted-foreground">{vehicle?.type} • {vehicle?.capacity} seats</p>
                            </div>
                          </div>
                          <StatusBadge
                            status="success"
                            label="Active"
                            animated={false}
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-3 border-t border-border">
                          <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                            <UserCircle className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{driver?.name || "Unassigned"}</p>
                            <p className="text-sm text-muted-foreground">{driver?.phone_number || "No driver assigned"}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
      </DashboardLayout>

      <AssignVehicleModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        onSubmit={handleAssignVehicle}
        tripId={selectedTrip?.trip_id || 0}
        availableVehicles={availableVehicles}
        availableDrivers={availableDrivers}
      />

      <CreateTripModal
        open={createTripModalOpen}
        onOpenChange={setCreateTripModalOpen}
        onSubmit={handleCreateTrip}
        availableRoutes={routes}
        availableVehicles={vehicles}
      />

      <EditTripModal
        open={editTripModalOpen}
        onOpenChange={setEditTripModalOpen}
        onSubmit={handleEditTrip}
        trip={selectedTrip}
        availableRoutes={routes}
      />
    </>
  );
}
