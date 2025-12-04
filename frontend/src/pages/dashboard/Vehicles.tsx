import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bus, Car, Edit, Clock, Plus, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { CreateVehicleModal } from "@/components/modals/CreateVehicleModal";
import { useToast } from "@/hooks/use-toast";
import type { VehicleCreate, Vehicle } from "@/types";
import { VehicleType } from "@/types";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL;

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/vehicles/all`);
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      const data = await response.json();
      setVehicles(data);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast({
        title: "Error",
        description: "Failed to load vehicles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVehicle = async (data: VehicleCreate) => {
    try {
      const response = await fetch(`${API_URL}/vehicles/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create vehicle");
      }

      const newVehicle = await response.json();
      setVehicles([...vehicles, newVehicle]);
      toast({
        title: "Vehicle added successfully!",
        description: `${data.license_plate} has been added to your fleet.`,
      });
      setCreateModalOpen(false);
    } catch (error: any) {
      console.error("Error creating vehicle:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create vehicle",
        variant: "destructive",
      });
    }
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    const typeMatch = filterType === "all" || vehicle.type === filterType;
    const statusMatch = filterStatus === "all" || vehicle.status === filterStatus;
    return typeMatch && statusMatch;
  });

  return (
    <>
      <DashboardLayout>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 gradient-text">Vehicle Fleet</h1>
            <p className="text-muted-foreground">Manage your transport fleet and assignments</p>
          </div>
          <Button 
            variant="gradient"
            className="gap-2 shadow-md"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Add Vehicle
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 animate-fadeIn">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search vehicles..." 
                className="pl-9 rounded-xl" 
              />
            </div>
            <select 
              className="px-4 py-2 border border-border rounded-xl bg-background text-sm hover:border-primary/50 transition-fast focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value={VehicleType.BUS}>Bus</option>
              <option value={VehicleType.CAB}>Cab</option>
            </select>
            <select 
              className="px-4 py-2 border border-border rounded-xl bg-background text-sm hover:border-primary/50 transition-fast focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </Card>
      </div>

      {/* Grid View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredVehicles.length === 0 ? (
        <EmptyState
          icon={Bus}
          title="No vehicles found"
          description={filterType !== "all" || filterStatus !== "all"
            ? "No vehicles match your current filters. Try adjusting your filter criteria."
            : "Get started by adding your first vehicle to the fleet. Click the button above to add a new vehicle."
          }
          action={filterType === "all" && filterStatus === "all" ? {
            label: "Add Vehicle",
            onClick: () => setCreateModalOpen(true)
          } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredVehicles.map((vehicle, index) => (
          <Card
            key={vehicle.vehicle_id}
            className={cn(
              "p-5 hover-lift group animate-fadeIn",
              "bg-gradient-to-br from-card to-card/50"
            )}
            style={{ animationDelay: `${(index % 8) * 50}ms` }}
          >
            {/* Vehicle Icon */}
            <div className="w-full h-32 bg-gradient-to-br from-primary/10 via-purple-500/10 to-accent/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
              {vehicle.type === VehicleType.BUS ? (
                <Bus className="w-16 h-16 text-primary animate-float" style={{ animationDelay: `${index * 0.1}s` }} />
              ) : (
                <Car className="w-16 h-16 text-primary animate-float" style={{ animationDelay: `${index * 0.1}s` }} />
              )}
            </div>

            {/* License Plate */}
            <h3 className="text-xl font-bold text-foreground mb-2 gradient-text">{vehicle.license_plate}</h3>

            {/* Type & Capacity */}
            <div className="flex items-center gap-2 mb-3">
              <StatusBadge
                status={vehicle.type === VehicleType.BUS ? "info" : "info"}
                label={vehicle.type}
                showIcon={false}
              />
              <span className="text-sm text-muted-foreground">{vehicle.capacity} seats</span>
            </div>

            {/* Status */}
            <div className="mb-3">
              <StatusBadge
                status={
                  vehicle.status === "active" ? "success" :
                  vehicle.status === "inactive" ? "pending" :
                  "warning"
                }
                label={vehicle.status}
                animated={vehicle.status === "active"}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-fast">
              <Button variant="outline" size="sm" className="flex-1 rounded-xl hover-lift">
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl hover-lift">
                <Clock className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
      )}
      </DashboardLayout>

      <CreateVehicleModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmit={handleCreateVehicle}
      />
    </>
  );
}
