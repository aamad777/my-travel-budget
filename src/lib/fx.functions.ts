import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  from: z.string().length(3).regex(/^[A-Z]{3}$/),
  to: z.string().length(3).regex(/^[A-Z]{3}$/),
});

// Approximate rates per 1 USD. Used as a fallback when the live API fails,
// so common currency pairs return realistic numbers instead of 1.
const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 157,
  CNY: 7.25,
  INR: 83.3,
  AUD: 1.52,
  CAD: 1.37,
  CHF: 0.89,
  SGD: 1.34,
  HKD: 7.82,
  AED: 3.6725,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.307,
  BHD: 0.376,
  OMR: 0.384,
  JOD: 0.709, // 1 JOD ≈ 1.41 USD ≈ 5.18 AED
  EGP: 48,
  TRY: 32.5,
  THB: 36.5,
  MYR: 4.7,
  IDR: 16200,
  PHP: 58,
  VND: 25400,
  KRW: 1380,
  TWD: 32.3,
  ZAR: 18.5,
  MXN: 18,
  BRL: 5.4,
  ARS: 950,
  NZD: 1.65,
  SEK: 10.6,
  NOK: 10.7,
  DKK: 6.88,
  PLN: 4,
  CZK: 23.2,
  HUF: 360,
  RON: 4.58,
  RUB: 92,
  ILS: 3.7,
  LKR: 300,
  PKR: 278,
  BDT: 119,
  NPR: 133,
  MAD: 9.95,
  TND: 3.12,
  KES: 129,
  NGN: 1550,
  GHS: 15.2,
};

function staticRate(from: string, to: string): number | null {
  const f = USD_RATES[from];
  const t = USD_RATES[to];
  if (!f || !t) return null;
  return t / f;
}

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
      const fallback = staticRate(data.from, data.to);
      if (fallback) return { rate: fallback, source: "static" as const };
      return { rate: 1, source: "fallback" as const };
    }
  });

