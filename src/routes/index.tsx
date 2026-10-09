import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bike, Car, Crosshair, History, Home, Loader2, MapPin, Sparkles, User, Zap } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { getPlaceLocation, getRoute, searchPlaces, type PlaceSuggestion } from "@/lib/maps.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { recommendRide, type RideRecommendation } from "@/lib/recommend.functions";
import { RideMap, type MapPoint } from "@/components/RideMap";

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
  { name: "Bike", icon: Bike, base: 20, perKm: 8, time: "3 min" },
  { name: "Auto", icon: Zap, base: 30, perKm: 12, time: "5 min" },
  { name: "Car", icon: Car, base: 50, perKm: 20, time: "7 min" },
];

type RouteInfo = { distanceKm: number; durationMinutes: number; polyline: string | null };

function Index() {
  const [selected, setSelected] = useState(0);
  const [pickup, setPickup] = useState<MapPoint | null>(null);
  const [destination, setDestination] = useState<MapPoint | null>(null);
  const [pickupLabel, setPickupLabel] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [locating, setLocating] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRec, setAiRec] = useState<RideRecommendation | null>(null);
  const [booking, setBooking] = useState<Tables<"ride_bookings"> | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);

  useEffect(() => setAiRec(null), [pickup, destination]);

  useEffect(() => {
    if (!pickup || !destination) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setLoadingRoute(true);
    getRoute({ data: { origin: pickup, destination } })
      .then((r) => {
        if (!cancelled) setRoute(r);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setRoute(null);
          toast.error("Could not find a route between these locations");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRoute(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickup, destination]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("GPS is not supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPickup({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setPickupLabel("My current location");
        toast.success("Pickup set to your current location");
      },
      () => {
        setLocating(false);
        toast.error("Could not get your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const askAi = async () => {
    if (!pickup || !destination || !route) {
      toast.error("Enter pickup and destination first");
      return;
    }
    setAiLoading(true);
    setAiRec(null);
    try {
      const rec = await recommendRide({
        data: {
          pickup: pickupLabel,
          destination: destinationLabel,
          choice: vehicles[selected]!.name,
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes,
          options: vehicles.map((v) => ({ name: v.name, fare: Math.round(v.base + v.perKm * route.distanceKm), eta: v.time })),
        },
      });
      setAiRec(rec);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not get a recommendation");
    } finally {
      setAiLoading(false);
    }
  };

  const bookRide = () => {
    if (!pickup || !destination) {
      toast.error("Please enter pickup and destination");
      return;
    }
    if (!route) {
      toast.error("Wait for the route to be calculated");
      return;
    }
    const v = vehicles[selected]!;
    const fare = Math.round(v.base + v.perKm * route.distanceKm);
    toast.success(`Searching for ${v.name}... Estimated fare ₹${fare}`);
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
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PlaceInput
                  label="Pickup Location"
                  value={pickupLabel}
                  onTextChange={(t) => {
                    setPickupLabel(t);
                    setPickup(null);
                  }}
                  onSelect={(p, label) => {
                    setPickup(p);
                    setPickupLabel(label);
                  }}
                  tone="text-success"
                />
              </div>
              <button
                onClick={useMyLocation}
                aria-label="Use my current location"
                title="Use my current location"
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-input bg-card text-primary transition-colors hover:bg-accent"
              >
                {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
              </button>
            </div>
            <PlaceInput
              label="Destination"
              value={destinationLabel}
              onTextChange={(t) => {
                setDestinationLabel(t);
                setDestination(null);
              }}
              onSelect={(p, label) => {
                setDestination(p);
                setDestinationLabel(label);
              }}
              tone="text-destructive"
            />
          </div>

          <div className="mt-5">
            <ClientOnly
              fallback={
                <div className="flex h-56 w-full items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
                  Loading map...
                </div>
              }
            >
              <RideMap pickup={pickup} destination={destination} polyline={route?.polyline ?? null} />
            </ClientOnly>
          </div>

          {(loadingRoute || route) && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
              {loadingRoute ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Calculating route...
                </span>
              ) : (
                route && (
                  <>
                    <span className="text-sm font-semibold text-foreground">{route.distanceKm} km</span>
                    <span className="text-sm text-muted-foreground">≈ {route.durationMinutes} min ride</span>
                  </>
                )
              )}
            </div>
          )}

          <h3 className="mt-8 mb-4 text-xl font-bold text-foreground">Choose Your Ride</h3>
          <div className="space-y-3">
            {vehicles.map((v, i) => {
              const Icon = v.icon;
              const active = selected === i;
              const fare = route ? Math.round(v.base + v.perKm * route.distanceKm) : null;
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
                    <div className="text-sm text-muted-foreground">
                      {v.time} away · ₹{v.base} + ₹{v.perKm}/km
                    </div>
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {fare !== null ? `₹${fare}` : "—"}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={askAi}
            disabled={aiLoading}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-card font-semibold text-primary transition-colors hover:bg-accent disabled:opacity-60"
          >
            {aiLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {aiLoading ? "Thinking..." : "Recommend best ride (AI)"}
          </button>
          {aiRec && (
            <div className="mt-3 rounded-2xl border border-primary bg-accent p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">AI suggests: {aiRec.recommended}</span>
                {vehicles[selected]?.name !== aiRec.recommended && (
                  <button
                    onClick={() => setSelected(vehicles.findIndex((v) => v.name === aiRec.recommended))}
                    className="text-sm font-semibold text-primary underline"
                  >
                    Choose it
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{aiRec.reason}</p>
            </div>
          )}


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

function PlaceInput({
  label,
  value,
  onTextChange,
  onSelect,
  tone,
}: {
  label: string;
  value: string;
  onTextChange: (t: string) => void;
  onSelect: (point: MapPoint, label: string) => void;
  tone: string;
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const text = value.trim();
    if (text.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      try {
        const { suggestions: results } = await searchPlaces({
          data: { input: text, sessionToken: sessionTokenRef.current },
        });
        if (requestId !== requestIdRef.current) return;
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const pick = async (s: PlaceSuggestion) => {
    setOpen(false);
    setBusy(true);
    try {
      const { location, label: placeLabel } = await getPlaceLocation({
        data: { placeId: s.placeId, sessionToken: sessionTokenRef.current },
      });
      sessionTokenRef.current = crypto.randomUUID();
      onSelect(location, placeLabel);
    } catch (err) {
      console.error(err);
      toast.error("Could not get that place's location");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-3 rounded-2xl border border-input bg-card px-4 py-3 focus-within:border-primary">
        <MapPin className={`h-5 w-5 ${tone}`} />
        <input
          value={value}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={label}
          className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </label>
      {open && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-foreground hover:bg-accent"
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
