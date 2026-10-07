import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bike, Car, History, Home, MapPin, User, Zap } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SPEED — Move Fast. Go Anywhere." },
      { name: "description", content: "Book a bike, auto or car ride in seconds with SPEED." },
      { property: "og:title", content: "SPEED — Move Fast. Go Anywhere." },
      { property: "og:description", content: "Book a bike, auto or car ride in seconds with SPEED." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const vehicles = [
  { name: "Bike", icon: Bike, price: "₹70", time: "3 min" },
  { name: "Auto", icon: Zap, price: "₹100", time: "5 min" },
  { name: "Car", icon: Car, price: "₹150", time: "7 min" },
];

function Index() {
  const [selected, setSelected] = useState(0);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");

  const bookRide = () => {
    if (!pickup.trim() || !destination.trim()) {
      toast.error("Please enter pickup and destination");
      return;
    }
    toast.success(`Searching for ${vehicles[selected]?.name ?? "ride"}...`);
  };

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-muted">
        <header className="relative flex items-center justify-center bg-primary py-4 text-primary-foreground shadow">
          <h1 className="text-xl font-bold tracking-[0.2em]">SPEED</h1>
          <button aria-label="Profile" className="absolute right-4 rounded-full p-2 hover:bg-primary-foreground/10">
            <User className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 p-5 pb-24">
          <h2 className="text-3xl font-bold text-foreground">Move Fast.</h2>
          <p className="text-2xl font-semibold text-primary">Go Anywhere.</p>

          <div className="mt-6 space-y-4">
            <LocationInput label="Pickup Location" value={pickup} onChange={setPickup} tone="text-success" />
            <LocationInput label="Destination" value={destination} onChange={setDestination} tone="text-destructive" />
          </div>

          <h3 className="mt-8 mb-4 text-xl font-bold text-foreground">Choose Your Ride</h3>
          <div className="space-y-3">
            {vehicles.map((v, i) => {
              const Icon = v.icon;
              const active = selected === i;
              return (
                <button
                  key={v.name}
                  onClick={() => setSelected(i)}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-colors ${
                    active ? "border-primary bg-accent" : "border-border bg-card"
                  }`}
                >
                  <Icon className="h-10 w-10 text-primary" />
                  <div className="flex-1">
                    <div className="text-lg font-bold text-foreground">{v.name}</div>
                    <div className="text-sm text-muted-foreground">{v.time} away</div>
                  </div>
                  <div className="text-lg font-bold text-foreground">{v.price}</div>
                </button>
              );
            })}
          </div>

          <button
            onClick={bookRide}
            className="mt-6 h-14 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow transition-opacity hover:opacity-90"
          >
            BOOK RIDE
          </button>
        </main>

        <nav className="fixed bottom-0 left-1/2 flex w-full max-w-md -translate-x-1/2 justify-around border-t border-border bg-card py-2">
          {[
            { label: "Home", icon: Home, active: true },
            { label: "Rides", icon: History },
            { label: "Profile", icon: User },
          ].map(({ label, icon: Icon, active }) => (
            <button key={label} className={`flex flex-col items-center text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}

function LocationInput({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tone: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-input bg-card px-4 py-3 focus-within:border-primary">
      <MapPin className={`h-5 w-5 ${tone}`} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}
