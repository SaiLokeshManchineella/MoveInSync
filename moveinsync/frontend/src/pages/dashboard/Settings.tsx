import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Building, Bell, Key, CreditCard } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "company", label: "Company Settings", icon: Building },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "api", label: "API Keys", icon: Key },
  { id: "billing", label: "Billing", icon: CreditCard },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2 gradient-text">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <Card className="p-4 h-fit animate-fadeIn">
          <nav className="space-y-1">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-primary/15 to-accent/10 text-primary font-semibold border-l-4 border-primary shadow-sm"
                    : "text-muted-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 hover:text-foreground"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </Card>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {activeTab === "profile" && (
            <Card className="p-6 animate-slideInLeft">
              <h2 className="text-xl font-bold text-foreground mb-6 gradient-text">Profile Settings</h2>
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-2xl text-primary-foreground font-bold shadow-lg animate-float">
                    SL
                  </div>
                  <div>
                    <Button variant="outline" size="sm" className="rounded-xl hover-lift">Change Photo</Button>
                    <p className="text-xs text-muted-foreground mt-2">JPG, PNG or GIF. Max 2MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" defaultValue="John" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" defaultValue="Doe" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="john@company.com" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" defaultValue="+1 234 567 8900" />
                </div>

                <Button variant="gradient" className="shadow-md">Save Changes</Button>
              </div>
            </Card>
          )}

          {activeTab === "company" && (
            <Card className="p-6 animate-slideInLeft">
              <h2 className="text-xl font-bold text-foreground mb-6 gradient-text">Company Settings</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" defaultValue="Your Company Inc." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" defaultValue="123 Business St, City, Country" />
                </div>
                <Button variant="gradient" className="shadow-md">Save Changes</Button>
              </div>
            </Card>
          )}

          {activeTab === "notifications" && (
            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-6">Notification Preferences</h2>
              <div className="space-y-4">
                <p className="text-muted-foreground">Manage your notification settings here.</p>
              </div>
            </Card>
          )}

          {activeTab === "api" && (
            <Card className="p-6 animate-slideInLeft">
              <h2 className="text-xl font-bold text-foreground mb-6 gradient-text">API Keys</h2>
              <div className="space-y-4">
                <p className="text-muted-foreground">Manage your API keys for integrations.</p>
              </div>
            </Card>
          )}

          {activeTab === "billing" && (
            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-6">Billing & Subscription</h2>
              <div className="space-y-4">
                <p className="text-muted-foreground">Manage your subscription and billing details.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
