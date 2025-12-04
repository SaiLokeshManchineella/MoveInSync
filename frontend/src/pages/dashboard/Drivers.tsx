import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, MoreVertical, Phone, Plus, Search, UserCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { CreateDriverModal } from "@/components/modals/CreateDriverModal";
import { useToast } from "@/hooks/use-toast";
import type { DriverCreate, Driver } from "@/types";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL;

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/drivers/all`);
      if (!response.ok) throw new Error("Failed to fetch drivers");
      const data = await response.json();
      setDrivers(data);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      toast({
        title: "Error",
        description: "Failed to load drivers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDriver = async (data: DriverCreate) => {
    try {
      const response = await fetch(`${API_URL}/drivers/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create driver");
      }

      const newDriver = await response.json();
      setDrivers([...drivers, newDriver]);
      toast({
        title: "Driver added successfully!",
        description: `${data.name} has been added to your team.`,
      });
      setCreateModalOpen(false);
    } catch (error: any) {
      console.error("Error creating driver:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create driver",
        variant: "destructive",
      });
    }
  };

  const filteredDrivers = drivers.filter((driver) =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.phone_number.includes(searchTerm)
  );

  return (
    <>
      <DashboardLayout>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2 gradient-text">Driver Management</h1>
            <p className="text-muted-foreground">Manage driver profiles and assignments</p>
          </div>
          <Button 
            variant="gradient"
            className="gap-2 shadow-md"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </Button>
        </div>

        <Card className="p-4 animate-fadeIn">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search drivers..." 
              className="pl-9 max-w-xs rounded-xl" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </Card>
      </div>

      {/* Table View */}
      <Card className="overflow-hidden animate-fadeIn">
        {loading ? (
          <div className="p-8">
            <SkeletonList count={5} />
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={searchTerm ? UserCircle : UserCircle}
              title={searchTerm ? "No drivers found" : "No drivers available"}
              description={searchTerm 
                ? `No drivers match "${searchTerm}". Try adjusting your search terms.`
                : "Get started by adding your first driver. Click the button above to add a new driver."
              }
              action={!searchTerm ? {
                label: "Add Driver",
                onClick: () => setCreateModalOpen(true)
              } : undefined}
            />
          </div>
        ) : (
          <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-primary/5 to-accent/5">
              <TableHead className="font-semibold">Driver ID</TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Phone Number</TableHead>
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDrivers.map((driver, index) => (
              <TableRow 
                key={driver.driver_id} 
                className={cn(
                  "hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-fast animate-fadeIn"
                )}
                style={{ animationDelay: `${(index % 10) * 30}ms` }}
              >
                <TableCell className="font-mono text-sm">#{driver.driver_id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-primary-foreground font-semibold shadow-md">
                      {driver.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <span className="font-semibold text-foreground">{driver.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-primary" />
                    <span className="text-foreground">{driver.phone_number}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 hover:bg-primary/10 rounded-lg transition-fast hover-lift">
                      <Edit className="w-4 h-4 text-primary" />
                    </button>
                    <button className="p-1.5 hover:bg-muted rounded-lg transition-fast hover-lift">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </Card>
      </DashboardLayout>

      <CreateDriverModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmit={handleCreateDriver}
      />
    </>
  );
}
