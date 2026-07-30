"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Euro, FileSpreadsheet, ListChecks, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

type GroupItem = {
  label: string;
  total: number;
  count: number;
};

type DashboardData = {
  kpis: {
    offers: number;
    activities: number;
    budgetLines: number;
    commesse: number;
    approvedAmount: number;
    offeredAmount: number;
    gap: number;
    budgetLineAmount: number;
  };
  byOffer: GroupItem[];
  byCommessa: GroupItem[];
  byActivity: GroupItem[];
  prepareQueue: Array<Record<string, unknown>>;
  recent: Array<{
    id: string;
    type: string;
    title: string;
    amount: number;
    status?: string | null;
    updatedAt: string;
  }>;
  warnings: Array<{
    label: string;
    count: number;
    severity: "ok" | "medium" | "high";
  }>;
};

function GroupList({ items, emptyLabel }: { items: GroupItem[]; emptyLabel: string }) {
  const max = useMemo(() => Math.max(...items.map((item) => item.total), 0), [items]);

  if (items.length === 0) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item) => {
        const pct = max > 0 ? Math.max((item.total / max) * 100, 4) : 0;
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{item.label}</span>
              <span className="shrink-0 text-muted-foreground">{formatCurrency(item.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[11px] text-muted-foreground">{item.count} record</div>
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({
  title,
  value,
  caption,
  icon: Icon,
  trend
}: {
  title: string;
  value: string | number;
  caption: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down";
}) {
  const TrendIcon = trend === "down" ? ArrowDownRight : ArrowUpRight;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <div className="min-w-0">
          <CardDescription>{title}</CardDescription>
          <CardTitle className="mt-2 truncate text-2xl">{value}</CardTitle>
        </div>
        <div className="rounded-md bg-accent p-2 text-accent-foreground">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="flex items-center gap-1 text-xs text-muted-foreground">
        {trend ? <TrendIcon className="size-3.5" /> : null}
        <span className="truncate">{caption}</span>
      </CardContent>
    </Card>
  );
}

function RecentRecords({ records }: { records: DashboardData["recent"] }) {
  if (records.length === 0) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Nessun record presente.</div>;
  }

  return (
    <>
      <div className="divide-y rounded-md border md:hidden">
        {records.map((record) => (
          <div key={`${record.type}-${record.id}`} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{record.type}</div>
                <div className="mt-1 line-clamp-2 text-sm font-medium">{record.title}</div>
              </div>
              <div className="shrink-0 text-right text-sm tabular-nums">{formatCurrency(record.amount)}</div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <StatusBadge value={record.status} />
              <span className="text-xs text-muted-foreground">{new Date(record.updatedAt).toLocaleDateString("it-IT")}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Titolo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="text-right">Importo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={`${record.type}-${record.id}`}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{record.type}</TableCell>
                <TableCell className="max-w-80 truncate font-medium">{record.title}</TableCell>
                <TableCell>
                  <StatusBadge value={record.status} />
                </TableCell>
                <TableCell className="text-right">{formatCurrency(record.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard", { cache: "no-store", signal });
      const payload = await response.json();

      if (signal?.aborted) return;

      if (!response.ok) {
        setError(payload.error ?? "Dashboard non disponibile");
        setData(null);
      } else {
        setData(payload);
      }
    } catch (error) {
      if (signal?.aborted) return;
      setError(error instanceof Error ? error.message : "Dashboard non disponibile");
      setData(null);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = () => void load();
    window.addEventListener("governance:data-refresh", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("governance:data-refresh", refresh);
    };
  }, [load]);

  if (loading && !data) {
    return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Caricamento dashboard...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="font-medium">Dashboard non disponibile</div>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>
          <RefreshCw />
          Riprova
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">General</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dashboard riepilogativa di offerte, commesse, activities e budget line.</p>
        </div>
        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Aggiorna
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Importo approvato" value={formatCurrency(data.kpis.approvedAmount)} caption="Valori approvati sulle offerte" icon={Euro} />
        <KpiCard title="Importo offerta" value={formatCurrency(data.kpis.offeredAmount)} caption="Valori offerta inseriti sulle offerte" icon={FileSpreadsheet} />
        <KpiCard
          title="Gap offerta/approvato"
          value={formatCurrency(data.kpis.gap)}
          caption="Importo offerta meno importo approvato"
          icon={data.kpis.gap >= 0 ? ArrowUpRight : ArrowDownRight}
          trend={data.kpis.gap >= 0 ? "up" : "down"}
        />
        <KpiCard title="Record governati" value={data.kpis.offers + data.kpis.activities + data.kpis.budgetLines + data.kpis.commesse} caption="Offers, Activities, BudgetLines e Commesse" icon={ListChecks} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Budget line per offerta</CardTitle>
            <CardDescription>Importi aggregati per offerta collegata.</CardDescription>
          </CardHeader>
          <CardContent>
            <GroupList items={data.byOffer} emptyLabel="Nessuna budget line importata." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Budget line per commessa</CardTitle>
            <CardDescription>Importi aggregati per commessa collegata.</CardDescription>
          </CardHeader>
          <CardContent>
            <GroupList items={data.byCommessa} emptyLabel="Nessuna commessa collegata." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Budget line per attività</CardTitle>
            <CardDescription>Importi aggregati per attività collegata.</CardDescription>
          </CardHeader>
          <CardContent>
            <GroupList items={data.byActivity} emptyLabel="Nessuna attività collegata." />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Record recenti</CardTitle>
            <CardDescription>Ultime modifiche tra offer, budget line e activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentRecords records={data.recent} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Offerte recenti</CardTitle>
              <CardDescription>Ultime offerte aggiornate con importo approvato.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.prepareQueue.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Nessuna offerta presente.</div>
              ) : (
                data.prepareQueue.map((offer) => (
                  <div key={String(offer.id)} className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{String(offer.codice ?? offer.externalId ?? "Offer")}</div>
                      <div className="text-xs text-muted-foreground">{String(offer.progetto ?? "Progetto non assegnato")}</div>
                    </div>
                    <div className="shrink-0 text-sm">{formatCurrency(Number(offer.importoApprovato ?? 0))}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Warning</CardTitle>
              <CardDescription>Controlli su record incompleti o incoerenti.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.warnings.map((warning) => (
                <div key={warning.label} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle className={warning.severity === "ok" ? "size-4 text-emerald-600" : "size-4 text-amber-600"} />
                    <span className="truncate text-sm">{warning.label}</span>
                  </div>
                  <StatusBadge value={warning.count === 0 ? "OK" : warning.count} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
