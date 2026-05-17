import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  from: z.string().length(3).regex(/^[A-Z]{3}$/),
  to: z.string().length(3).regex(/^[A-Z]{3}$/),
});

// Returns the FX rate from `from` to `to` (i.e. 1 unit of `from` in `to`).
export const getFxRate = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.from === data.to) return { rate: 1, source: "identity" as const };
    try {
      const res = await fetch(
        `https://api.exchangerate.host/convert?from=${data.from}&to=${data.to}`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
      const json = (await res.json()) as { result?: number; info?: { rate?: number } };
      const rate = json.result ?? json.info?.rate;
      if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
        throw new Error("FX rate unavailable");
      }
      return { rate, source: "exchangerate.host" as const };
    } catch (err) {
      console.error("FX lookup failed", err);
      return { rate: 1, source: "fallback" as const };
    }
  });
