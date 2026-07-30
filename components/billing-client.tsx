"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Mail, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type OfferOption = {
  id: string;
  codice: string;
  nome?: string | null;
  externalId?: string | null;
  progetto?: string | null;
  anno?: number | null;
};

type BillingLine = {
  id: string;
  externalId?: string | null;
  nome?: string | null;
  commessa: string;
  attivita: string;
  importo: number;
};

type BillingPayload = {
  offer: {
    id: string;
    externalId?: string | null;
    codice: string;
    progetto?: string | null;
    anno?: number | null;
    importoApprovato: number;
    importoOfferta: number;
  };
  lines: BillingLine[];
  totals: {
    count: number;
    importo: number;
  };
};

function plainCell(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function htmlCell(value: unknown) {
  return plainCell(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMailSubject(payload: BillingPayload | null) {
  if (!payload) return "";
  return `Fatturazione offerta ${payload.offer.codice || payload.offer.externalId || payload.offer.id}`;
}

function buildMailBody(payload: BillingPayload | null) {
  if (!payload) return "";
  const offerLabel = payload.offer.codice || payload.offer.externalId || payload.offer.id;
  const context = [payload.offer.progetto, payload.offer.anno].filter(Boolean).join(" - ");
  const rows = payload.lines.map((line) =>
    [
      plainCell(line.externalId || line.id),
      plainCell(line.nome),
      plainCell(line.commessa),
      plainCell(line.attivita),
      formatCurrency(line.importo)
    ].join("\t")
  );

  return [
    "Buongiorno,",
    "",
    `di seguito le budget line associate all'offerta ${offerLabel}${context ? ` (${context})` : ""}.`,
    "",
    ["ID", "Nome", "Commessa", "Attività", "Importo"].join("\t"),
    ...rows,
    "",
    ["Totale", "", "", payload.totals.count, formatCurrency(payload.totals.importo)].join("\t"),
    "",
    "Grazie."
  ].join("\n");
}

function buildHtmlTable(payload: BillingPayload | null) {
  if (!payload) return "";
  const rows = payload.lines
    .map(
      (line) => `
        <tr>
          <td>${htmlCell(line.externalId || line.id)}</td>
          <td>${htmlCell(line.nome)}</td>
          <td>${htmlCell(line.commessa)}</td>
          <td>${htmlCell(line.attivita)}</td>
          <td style="text-align:right">${htmlCell(formatCurrency(line.importo))}</td>
        </tr>`
    )
    .join("");

  return `
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
      <thead>
        <tr style="background:#e7f0ee">
          <th>ID</th>
          <th>Nome</th>
          <th>Commessa</th>
          <th>Attività</th>
          <th>Importo</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="font-weight:bold">
          <td colspan="4">Totale (${payload.totals.count} budget line)</td>
          <td style="text-align:right">${htmlCell(formatCurrency(payload.totals.importo))}</td>
        </tr>
      </tbody>
    </table>`;
}

export function BillingClient() {
  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const subject = useMemo(() => buildMailSubject(payload), [payload]);
  const body = useMemo(() => buildMailBody(payload), [payload]);
  const htmlTable = useMemo(() => buildHtmlTable(payload), [payload]);
  const mailHref = useMemo(() => {
    if (!payload) return "#";
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [body, payload, subject]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/billing/offer", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Impossibile caricare le offerte");
        setOffers(data.offers ?? []);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Impossibile caricare le offerte");
      });

    return () => controller.abort();
  }, []);

  async function loadOffer(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const value = query.trim();
    if (!value) {
      setError("Inserisci un codice o un nome offerta.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/billing/offer?q=${encodeURIComponent(value)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Offerta non trovata");
      setPayload(data);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Impossibile generare la mail");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, okMessage: string) {
    await navigator.clipboard.writeText(text);
    setMessage(okMessage);
  }

  async function copyHtmlTable() {
    if (!payload) return;

    if ("ClipboardItem" in window && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([htmlTable], { type: "text/html" }),
          "text/plain": new Blob([body], { type: "text/plain" })
        })
      ]);
    } else {
      await navigator.clipboard.writeText(body);
    }

    setMessage("Tabella copiata.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">Fatturazione</h1>
          <p className="mt-1 text-sm text-muted-foreground">Generazione mail da offerta e budget line collegate.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Offerta</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={loadOffer}>
            <div className="min-w-0 flex-1">
              <Input
                id="billing-offer-code"
                list="billing-offer-codes"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca offerta per codice o nome"
                aria-label="Cerca offerta per codice o nome"
              />
              <datalist id="billing-offer-codes">
                {offers.flatMap((offer) => {
                  const values = Array.from(
                    new Set([offer.codice, offer.nome, offer.externalId].filter((value): value is string => Boolean(value)))
                  );
                  return values.map((value) => (
                    <option key={`${offer.id}-${value}`} value={value}>
                      {[offer.codice, offer.nome, offer.progetto, offer.anno].filter(Boolean).join(" - ")}
                    </option>
                  ));
                })}
              </datalist>
            </div>
            <Button className="w-full sm:w-auto" type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Search />}
              Genera
            </Button>
          </form>

          {error ? <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          {message ? <div className="mt-3 rounded-md border bg-accent px-3 py-2 text-sm text-accent-foreground">{message}</div> : null}
        </CardContent>
      </Card>

      {payload ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Mail</CardTitle>
              <CardDescription>{payload.totals.count} budget line - totale {formatCurrency(payload.totals.importo)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
                <div>
                  <Label htmlFor="billing-subject">Oggetto</Label>
                  <Input id="billing-subject" className="mt-1.5" value={subject} readOnly />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end lg:self-end">
                  <Button className="w-full sm:w-auto" variant="outline" type="button" onClick={() => copyText(body, "Testo mail copiato.")}>
                    <Copy />
                    Copia testo
                  </Button>
                  <Button className="w-full sm:w-auto" variant="outline" type="button" onClick={copyHtmlTable}>
                    <Copy />
                    Copia tabella
                  </Button>
                  <Button className="w-full sm:w-auto" asChild>
                    <a href={mailHref}>
                      <Send />
                      Apri mail
                    </a>
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="billing-body">Corpo</Label>
                <Textarea id="billing-body" className="mt-1.5 min-h-52 font-mono text-xs" value={body} readOnly />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Budget line</CardTitle>
              <CardDescription>{payload.offer.codice || payload.offer.externalId}</CardDescription>
            </CardHeader>
            <CardContent>
              {payload.lines.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Nessuna budget line collegata.</div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Commessa</TableHead>
                        <TableHead>Attività</TableHead>
                        <TableHead className="text-right">Importo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payload.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{line.externalId || line.id}</TableCell>
                          <TableCell className="max-w-80 truncate font-medium">{line.nome || "-"}</TableCell>
                          <TableCell className="max-w-72 truncate">{line.commessa || "-"}</TableCell>
                          <TableCell className="max-w-72 truncate">{line.attivita || "-"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(line.importo)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} className="font-semibold">
                          Totale
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(payload.totals.importo)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="size-4" />
              <span>Nessuna mail generata.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
