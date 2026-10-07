import { createServerFn } from "@tanstack/react-start";

export type RideRecommendation = { recommended: "Bike" | "Auto" | "Car"; reason: string };

type Input = {
  pickup: string;
  destination: string;
  choice: string;
  distanceKm: number;
  durationMinutes: number;
  options: { name: string; fare: number; eta: string }[];
};

export const recommendRide = createServerFn({ method: "POST" })
  .inputValidator((d: Input) => {
    if (!d || typeof d.pickup !== "string" || typeof d.destination !== "string") throw new Error("Invalid trip");
    if (!Number.isFinite(d.distanceKm) || !Array.isArray(d.options) || d.options.length > 5) throw new Error("Invalid trip");
    return {
      pickup: d.pickup.slice(0, 200),
      destination: d.destination.slice(0, 200),
      choice: String(d.choice).slice(0, 20),
      distanceKm: d.distanceKm,
      durationMinutes: Number(d.durationMinutes) || 0,
      options: d.options.map((o) => ({ name: String(o.name).slice(0, 20), fare: Number(o.fare), eta: String(o.eta).slice(0, 20) })),
    };
  })
  .handler(async ({ data }): Promise<RideRecommendation> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const prompt = `Trip: from "${data.pickup}" to "${data.destination}", ${data.distanceKm} km, about ${data.durationMinutes} min by road in India.
Rider's current choice: ${data.choice}.
Options: ${data.options.map((o) => `${o.name} (₹${o.fare}, ${o.eta} away)`).join("; ")}.
Recommend the best ride considering cost, comfort, distance and speed. Bikes suit short solo trips, autos mid-range budget trips, cars long or comfortable trips. Give a friendly reason in 1-2 short sentences mentioning whether their choice is good.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        text: {
          format: {
            type: "json_schema",
            name: "ride_recommendation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["recommended", "reason"],
              properties: {
                recommended: { type: "string", enum: ["Bike", "Auto", "Car"] },
                reason: { type: "string" },
              },
            },
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      console.error(`AI recommend failed [${res.status}]: ${body}`);
      if (res.status === 429) throw new Error("Too many requests, please try again shortly.");
      if (res.status === 402) throw new Error("AI credits are used up for this workspace.");
      throw new Error("Could not get a recommendation right now.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta") text += evt.delta ?? "";
          if (evt.type === "error" || evt.type === "response.failed") throw new Error("AI request failed");
        } catch (e) {
          if (e instanceof Error && e.message === "AI request failed") throw e;
        }
      }
    }
    try {
      const parsed = JSON.parse(text) as RideRecommendation;
      if (!["Bike", "Auto", "Car"].includes(parsed.recommended)) throw new Error();
      return parsed;
    } catch {
      throw new Error("The AI did not return a recommendation.");
    }
  });
