import { cn } from "@/lib/utils";

/**
 * CSS-only charts — no charting dependency. The shapes here (a daily bar
 * series, a funnel, a share bar) are simple enough that a library would cost
 * more in bundle size and mobile layout pain than it saves.
 */

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "good";
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-display text-2xl font-bold",
          tone === "warn" && "text-amber-600",
          tone === "good" && "text-emerald-600",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Daily signups, tenants and hosts stacked per day. */
export function SignupBars({
  points,
}: {
  points: { day: string; tenants: number; hosts: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.tenants + p.hosts));
  return (
    <div>
      <div className="flex h-36 items-end gap-0.5 overflow-x-auto">
        {points.map((p) => {
          const total = p.tenants + p.hosts;
          return (
            <div
              key={p.day}
              className="flex min-w-1.5 flex-1 flex-col justify-end"
              title={`${p.day}: ${p.tenants} renter${p.tenants === 1 ? "" : "s"}, ${p.hosts} host${p.hosts === 1 ? "" : "s"}`}
            >
              {p.hosts > 0 && (
                <div
                  className="rounded-t bg-accent"
                  style={{ height: `${(p.hosts / max) * 100}%` }}
                />
              )}
              {p.tenants > 0 && (
                <div
                  className="bg-primary"
                  style={{ height: `${(p.tenants / max) * 100}%` }}
                />
              )}
              {total === 0 && <div className="h-px bg-border" />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" /> Renters
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent" /> Hosts
        </span>
      </div>
    </div>
  );
}

/** Each stage as a share of the widest one, with drop-off called out. */
export function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1]!.value : null;
        const drop = prev && prev > 0 ? Math.round((1 - stage.value / prev) * 100) : null;
        return (
          <div key={stage.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{stage.label}</span>
              <span className="text-muted-foreground">
                {stage.value}
                {drop !== null && drop > 0 && (
                  <span className="ml-2 text-xs text-amber-600">−{drop}%</span>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(stage.value / max) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal share bars, used for the city breakdown. */
export function ShareBars({
  rows,
}: {
  rows: { label: string; value: number; sub?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="text-muted-foreground">
              {r.value}
              {r.sub && <span className="ml-2 text-xs">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
