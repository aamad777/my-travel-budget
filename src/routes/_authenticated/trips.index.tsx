import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { tripsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Calendar } from "lucide-react";
import { formatMoney } from "@/lib/currencies";
import { BudgetRing } from "@/routes/index";

export const Route = createFileRoute("/_authenticated/trips/")({
  head: () => ({ meta: [{ title: "My Trips - Voyage" }] }),
  component: TripsList,
});

type TripRow = {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_amount: number;
  currency: string;
};

function TripsList() {
  const { data: trips, isLoading, error } = useQuery({
    queryKey: ["trips"],
    queryFn: async (): Promise<Array<TripRow & { spent: number }>> => {
      const data = await tripsApi.list();

      return data.trips.map((trip) => ({
        ...trip,
        spent: 0,
      }));
    },
  });

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-card/70 p-6">
        <h1 className="text-xl font-semibold">Could not load trips</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Trips</h1>
          <p className="text-sm text-muted-foreground">Pick a trip or start a new one.</p>
        </div>

        <Button asChild className="shadow-glow">
          <Link to="/trips/new">
            <Plus className="mr-1 h-4 w-4" /> New trip
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !trips?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <h2 className="text-lg font-semibold">No trips yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first trip to start tracking expenses.
          </p>

          <Button asChild className="mt-5">
            <Link to="/trips/new">
              <Plus className="mr-1 h-4 w-4" /> Create a trip
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {trips.map((trip) => {
            const budgetAmount = Number(trip.budget_amount);
            const pct = budgetAmount > 0 ? (trip.spent / budgetAmount) * 100 : 0;

            return (
              <Link
                key={trip.id}
                to="/trips/$tripId"
                params={{ tripId: trip.id }}
                className="group rounded-2xl border border-border bg-card/70 p-5 transition hover:shadow-glow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold group-hover:text-primary">
                      {trip.name}
                    </h3>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {trip.destination && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {trip.destination}
                        </span>
                      )}

                      {(trip.start_date || trip.end_date) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {trip.start_date} {trip.end_date ? `→ ${trip.end_date}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <BudgetRing percent={pct} label={`${Math.round(pct)}%`} />
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-semibold">{formatMoney(trip.spent, trip.currency)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Budget</span>
                  <span>{formatMoney(budgetAmount, trip.currency)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}