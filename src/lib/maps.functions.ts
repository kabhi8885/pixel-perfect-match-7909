import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    throw new Error("Google Maps connection is not configured");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
    "Content-Type": "application/json",
  };
}

export type PlaceSuggestion = {
  placeId: string;
  text: string;
};

export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((data: { input: string; sessionToken: string }) => {
    if (!data || typeof data.input !== "string" || data.input.trim().length < 2) {
      throw new Error("Search text is too short");
    }
    if (data.input.length > 120) {
      throw new Error("Search text is too long");
    }
    return { input: data.input.trim(), sessionToken: String(data.sessionToken ?? "") };
  })
  .handler(async ({ data }): Promise<{ suggestions: PlaceSuggestion[] }> => {
    const response = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        ...gatewayHeaders(),
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({
        input: data.input,
        sessionToken: data.sessionToken,
        includedRegionCodes: ["in"],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Places autocomplete failed [${response.status}]: ${body}`);
      throw new Error("Could not fetch place suggestions");
    }
    const json = (await response.json()) as {
      suggestions?: Array<{
        placePrediction?: { placeId?: string; text?: { text?: string } };
      }>;
    };
    const suggestions = (json.suggestions ?? [])
      .map((s) => ({
        placeId: s.placePrediction?.placeId ?? "",
        text: s.placePrediction?.text?.text ?? "",
      }))
      .filter((s) => s.placeId && s.text)
      .slice(0, 5);
    return { suggestions };
  });

export type LatLng = { latitude: number; longitude: number };

function isValidLatLng(p: LatLng | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}

export const getPlaceLocation = createServerFn({ method: "POST" })
  .inputValidator((data: { placeId: string; sessionToken?: string }) => {
    if (!data || typeof data.placeId !== "string" || data.placeId.length < 3 || data.placeId.length > 300) {
      throw new Error("Invalid place");
    }
    return { placeId: data.placeId, sessionToken: data.sessionToken };
  })
  .handler(async ({ data }): Promise<{ location: LatLng; label: string }> => {
    const url = new URL(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(data.placeId)}`);
    if (data.sessionToken) url.searchParams.set("sessionToken", data.sessionToken);
    const response = await fetch(url.toString(), {
      headers: {
        ...gatewayHeaders(),
        "X-Goog-FieldMask": "location,displayName,formattedAddress",
      },
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Place details failed [${response.status}]: ${body}`);
      throw new Error("Could not fetch place details");
    }
    const json = (await response.json()) as {
      location?: LatLng;
      displayName?: { text?: string };
      formattedAddress?: string;
    };
    if (!isValidLatLng(json.location)) {
      throw new Error("Place has no location");
    }
    return {
      location: json.location,
      label: json.displayName?.text ?? json.formattedAddress ?? "Selected place",
    };
  });

export const getRoute = createServerFn({ method: "POST" })
  .inputValidator((data: { origin: LatLng; destination: LatLng }) => {
    if (!data || !isValidLatLng(data.origin) || !isValidLatLng(data.destination)) {
      throw new Error("Invalid origin or destination");
    }
    return data;
  })
  .handler(
    async ({
      data,
    }): Promise<{
      distanceKm: number;
      durationMinutes: number;
      polyline: string | null;
    }> => {
      const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
        method: "POST",
        headers: {
          ...gatewayHeaders(),
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: { location: { latLng: data.origin } },
          destination: { location: { latLng: data.destination } },
          travelMode: "DRIVE",
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error(`Route computation failed [${response.status}]: ${body}`);
        throw new Error("Could not compute the route");
      }
      const json = (await response.json()) as {
        routes?: Array<{
          distanceMeters?: number;
          duration?: string;
          polyline?: { encodedPolyline?: string };
        }>;
      };
      const route = json.routes?.[0];
      if (!route || typeof route.distanceMeters !== "number") {
        throw new Error("No route found between these locations");
      }
      const durationSeconds = route.duration ? parseFloat(route.duration) : 0;
      return {
        distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
        durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
        polyline: route.polyline?.encodedPolyline ?? null,
      };
    },
  );
