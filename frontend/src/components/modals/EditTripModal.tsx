import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DailyTrip, DailyTripCreate, Route } from "@/types";
import { Loader2 } from "lucide-react";

interface EditTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DailyTripCreate) => void;
  trip: DailyTrip | null;
  availableRoutes?: Route[];
}

export function EditTripModal({
  open,
  onOpenChange,
  onSubmit,
  trip,
  availableRoutes = [],
}: EditTripModalProps) {
  const [formData, setFormData] = useState<DailyTripCreate>({
    route_id: 0,
    display_name: "",
    booking_status_percentage: 0,
    live_status: "scheduled",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with trip data when modal opens
  useEffect(() => {
    if (trip && open) {
      setFormData({
        route_id: trip.route_id,
        display_name: trip.display_name,
        booking_status_percentage: trip.booking_status_percentage,
        live_status: trip.live_status,
      });
    }
  }, [trip, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.route_id === 0) {
      alert("Please select a route");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Don't render form content if trip is not available
  if (!trip) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Trip</DialogTitle>
          <DialogDescription>
            Update trip details and booking status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Route Selection */}
            <div className="grid gap-2">
              <Label htmlFor="route">Route *</Label>
              <Select
                value={formData.route_id.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, route_id: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a route" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoutes.map((route) => (
                    <SelectItem
                      key={route.route_id}
                      value={route.route_id.toString()}
                    >
                      {route.route_display_name} ({route.direction} - {route.shift_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Display Name */}
            <div className="grid gap-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                placeholder="e.g., Morning Shift - 08:00"
                required
              />
            </div>

            {/* Booking Status */}
            <div className="grid gap-2">
              <Label htmlFor="booking_percentage">
                Booking Percentage: {formData.booking_status_percentage}%
              </Label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="booking_percentage"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.booking_status_percentage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      booking_status_percentage: parseInt(e.target.value),
                    })
                  }
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.booking_status_percentage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      booking_status_percentage: Math.min(
                        100,
                        Math.max(0, parseInt(e.target.value) || 0)
                      ),
                    })
                  }
                  className="w-20"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Empty</span>
                <span>Half Full</span>
                <span>Fully Booked</span>
              </div>
            </div>

            {/* Live Status */}
            <div className="grid gap-2">
              <Label htmlFor="live_status">Trip Status *</Label>
              <Select
                value={formData.live_status}
                onValueChange={(value) =>
                  setFormData({ ...formData, live_status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Scheduled
                    </span>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                      In Progress
                    </span>
                  </SelectItem>
                  <SelectItem value="completed">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Completed
                    </span>
                  </SelectItem>
                  <SelectItem value="cancelled">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Cancelled
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warning for high booking changes */}
            {trip && 
             trip.booking_status_percentage > 50 && 
             formData.booking_status_percentage < trip.booking_status_percentage - 20 && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  ⚠️ You're reducing booking from {trip.booking_status_percentage}% to{" "}
                  {formData.booking_status_percentage}%. This may affect passengers.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
