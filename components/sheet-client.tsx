"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable
} from "@tanstack/react-table";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowDownUp, Check, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatNumber, formatPercent, toDateInput } from "@/lib/utils";
import type { LookupPayload } from "@/lib/repository";
import { configTypes, sheetConfigs, type FieldConfig, type SheetKey } from "@/lib/sheets";
import { cn } from "@/lib/utils";

type RecordRow = Record<string, unknown> & { id: string };
type RecordFormValues = Record<string, unknown>;

const formSchema = z.object({}).catchall(z.unknown());

function displayValue(row: RecordRow, field: FieldConfig): string {
  if (field.type === "relation") {
    if (field.key === "activityId") return String(row.activityLabel ?? row.activityExcelId ?? row.activityId ?? "");
    if (field.key === "commessaId") return String(row.commessaLabel ?? row.commessaId ?? "");
    if (field.key === "offerId") return String(row.offerLabel ?? row.offerId ?? "");
  }

  const value = row[field.key];
  if (field.type === "currency") return formatCurrency(Number(value ?? 0));
  if (field.type === "percent") return formatPercent(Number(value ?? 0));
  if (field.type === "number") return value === null || value === undefined ? "" : formatNumber(Number(value));
  if (field.type === "boolean") return value ? "Sì" : "No";
  if (field.type === "json") return value ? JSON.stringify(value) : "";
  return String(value ?? "");
}

function primitiveValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function fieldOptions(field: FieldConfig, lookups: LookupPayload | null, records: RecordRow[]) {
  if (field.lookupType && lookups) {
    return lookups.lookups[field.lookupType].map((item) => ({
      value: item.id,
      label: item.meta ? `${item.label} (${item.meta})` : item.label
    }));
  }

  if (field.key === "type") {
    return configTypes.map((type) => ({ value: type, label: type }));
  }

  if (field.optionType && lookups) {
    return (lookups.options[field.optionType] ?? []).map((value) => ({ value, label: value }));
  }

  const unique = Array.from(new Set(records.map((record) => primitiveValue(record[field.key])).filter(Boolean))).sort();
  return unique.map((value) => ({ value, label: value }));
}

function matchesFilter(row: RecordRow, field: FieldConfig, value: string) {
  if (!value) return true;
  const label = displayValue(row, field).toLowerCase();
  return label === value.toLowerCase() || primitiveValue(row[field.key]).toLowerCase() === value.toLowerCase();
}

function rowMatchesSearch(row: RecordRow, fields: FieldConfig[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => displayValue(row, field).toLowerCase().includes(q));
}

function linkValue(row: RecordRow, field: FieldConfig) {
  if (field.label.toLowerCase() !== "link") return null;
  const value = displayValue(row, field).trim();
  if (!/^https?:\/\//i.test(value)) return null;
  return value;
}

function formatCell(row: RecordRow, field: FieldConfig) {
  if (field.key === "stato") return <StatusBadge value={row[field.key]} />;
  if (field.key === "preparaOfferta" && row[field.key]) return <StatusBadge value="Da preparare" />;
  const href = linkValue(row, field);
  if (href) {
    return (
      <a className="block max-w-72 truncate text-primary underline-offset-4 hover:underline" href={href} target="_blank" rel="noreferrer">
        {href}
      </a>
    );
  }
  if (field.type === "boolean") return <span className="text-muted-foreground">{displayValue(row, field)}</span>;
  if (field.type === "currency" || field.type === "derived") {
    if (field.label.toLowerCase().includes("importo") || field.label.toLowerCase().includes("budget") || field.label.toLowerCase().includes("sconto")) {
      return <span className="tabular-nums">{formatCurrency(Number(row[field.key] ?? 0))}</span>;
    }
  }
  return <span className="block max-w-72 truncate">{displayValue(row, field)}</span>;
}

function formatMobileCell(row: RecordRow, field: FieldConfig) {
  if (field.key === "stato") return <StatusBadge value={row[field.key]} />;
  if (field.key === "preparaOfferta" && row[field.key]) return <StatusBadge value="Da preparare" />;
  const href = linkValue(row, field);
  if (href) {
    return (
      <a className="break-all text-primary underline-offset-4 hover:underline" href={href} target="_blank" rel="noreferrer">
        {href}
      </a>
    );
  }
  if (field.type === "boolean") return <span className="text-muted-foreground">{displayValue(row, field)}</span>;
  if (field.type === "currency" || field.type === "derived") {
    if (field.label.toLowerCase().includes("importo") || field.label.toLowerCase().includes("budget") || field.label.toLowerCase().includes("sconto")) {
      return <span className="tabular-nums">{formatCurrency(Number(row[field.key] ?? 0))}</span>;
    }
  }
  const value = displayValue(row, field);
  return <span className="break-words">{value || "-"}</span>;
}

function getMobileTitleField(fields: FieldConfig[]) {
  return fields.find((field) => ["nome", "attivita", "nomeCodice"].includes(field.key)) ?? fields[1] ?? fields[0];
}

function MobileRecordCards({
  rows,
  fields,
  loading,
  recordsCount,
  onEdit,
  onRemove
}: {
  rows: RecordRow[];
  fields: FieldConfig[];
  loading: boolean;
  recordsCount: number;
  onEdit: (record: RecordRow) => void;
  onRemove: (record: RecordRow) => void;
}) {
  const titleField = getMobileTitleField(fields);
  const idField = fields.find((field) => field.key === "externalId");
  const detailFields = fields.filter((field) => field.key !== titleField?.key);

  if (loading && recordsCount === 0) {
    return <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground md:hidden">Caricamento...</div>;
  }

  if (rows.length === 0) {
    return <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground md:hidden">Nessun record.</div>;
  }

  return (
    <div className="space-y-3 md:hidden">
      {rows.map((row) => (
        <article key={row.id} className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {idField ? <div className="text-xs text-muted-foreground">{displayValue(row, idField)}</div> : null}
              <h2 className="mt-1 line-clamp-2 text-sm font-semibold">{titleField ? displayValue(row, titleField) || row.id : row.id}</h2>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" title="Apri dettaglio" onClick={() => onEdit(row)}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon" title="Elimina" onClick={() => onRemove(row)}>
                <Trash2 />
              </Button>
            </div>
          </div>

          <dl className="mt-3 divide-y">
            {detailFields.map((field) => (
              <div key={field.key} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3 py-2 text-xs">
                <dt className="min-w-0 text-muted-foreground">{field.label}</dt>
                <dd className="min-w-0 text-right font-medium">{formatMobileCell(row, field)}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

function EditableCell({
  row,
  field,
  records,
  lookups,
  onSave
}: {
  row: RecordRow;
  field: FieldConfig;
  records: RecordRow[];
  lookups: LookupPayload | null;
  onSave: (id: string, key: string, value: unknown) => void;
}) {
  const [value, setValue] = useState(primitiveValue(row[field.key]));
  const options = fieldOptions(field, lookups, records);

  useEffect(() => {
    setValue(primitiveValue(row[field.key]));
  }, [row, field.key]);

  if (field.readonly || field.type === "derived") {
    return <div className="min-h-8 rounded-md px-2 py-1.5">{formatCell(row, field)}</div>;
  }

  if (field.type === "json") {
    return <div className="max-w-64 truncate text-muted-foreground">{displayValue(row, field)}</div>;
  }

  if (field.type === "boolean") {
    return (
      <button
        type="button"
        className={cn(
          "flex size-7 items-center justify-center rounded-md border transition-colors",
          row[field.key] ? "bg-primary text-primary-foreground" : "bg-background text-transparent"
        )}
        onClick={() => onSave(row.id, field.key, !row[field.key])}
        title={field.label}
      >
        <Check className="size-4" />
      </button>
    );
  }

  if ((field.type === "select" && options.length > 0) || field.type === "relation") {
    const current = primitiveValue(row[field.key]);
    const allOptions = current && !options.some((option) => option.value === current) ? [{ value: current, label: displayValue(row, field) }, ...options] : options;
    return (
      <select
        className="h-8 min-w-36 rounded-md border bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={current}
        onChange={(event) => onSave(row.id, field.key, event.target.value || null)}
      >
        <option value="">-</option>
        {allOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  const inputType = field.type === "date" ? "date" : field.type === "number" || field.type === "currency" || field.type === "percent" ? "number" : "text";

  return (
    <Input
      type={inputType}
      className="h-8 min-w-28 border-transparent bg-transparent px-2 shadow-none hover:border-input hover:bg-background focus:bg-background"
      value={field.type === "date" ? toDateInput(value) : value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        if (value !== primitiveValue(row[field.key])) {
          onSave(row.id, field.key, value);
        }
      }}
    />
  );
}

function RecordDialog({
  open,
  mode,
  record,
  fields,
  records,
  lookups,
  onOpenChange,
  onSubmit
}: {
  open: boolean;
  mode: "create" | "edit";
  record: RecordRow | null;
  fields: FieldConfig[];
  records: RecordRow[];
  lookups: LookupPayload | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: RecordFormValues) => Promise<void>;
}) {
  const editableFields = fields.filter((field) => !field.readonly && field.type !== "derived");
  const [isPending, startTransition] = useTransition();
  const form = useForm<RecordFormValues>({
    resolver: zodResolver(formSchema),
    values: Object.fromEntries(
      editableFields.map((field) => [
        field.key,
        field.type === "date" ? toDateInput(record?.[field.key] as string | undefined) : field.type === "json" ? displayValue((record ?? { id: "" }) as RecordRow, field) : record?.[field.key] ?? ""
      ])
    )
  });

  function submit(values: RecordFormValues) {
    startTransition(async () => {
      await onSubmit(values);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nuovo record" : "Dettaglio record"}</DialogTitle>
          <DialogDescription>{mode === "create" ? "Inserimento completo con relazioni e campi tecnici." : "Modifica dei campi editabili del record."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="min-h-0">
          <div className="grid max-h-[calc(100dvh-11rem)] gap-4 overflow-y-auto p-4 sm:max-h-[62vh] sm:p-5 md:grid-cols-2">
            {editableFields.map((field) => {
              const options = fieldOptions(field, lookups, records);
              return (
                <div key={field.key} className={field.type === "json" ? "md:col-span-2" : ""}>
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <div className="mt-1.5">
                    {field.type === "json" ? (
                      <Textarea id={field.key} {...form.register(field.key)} />
                    ) : field.type === "boolean" ? (
                      <Controller
                        control={form.control}
                        name={field.key}
                        render={({ field: controllerField }) => (
                          <button
                            type="button"
                            className={cn(
                              "flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm",
                              controllerField.value ? "bg-accent text-accent-foreground" : "bg-background"
                            )}
                            onClick={() => controllerField.onChange(!controllerField.value)}
                          >
                            <span>{controllerField.value ? "Sì" : "No"}</span>
                            {controllerField.value ? <Check className="size-4" /> : null}
                          </button>
                        )}
                      />
                    ) : (field.type === "select" && options.length > 0) || field.type === "relation" ? (
                      <Controller
                        control={form.control}
                        name={field.key}
                        render={({ field: controllerField }) => (
                          <Select value={primitiveValue(controllerField.value)} onValueChange={controllerField.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type === "date" ? "date" : field.type === "number" || field.type === "currency" || field.type === "percent" ? "number" : "text"}
                        {...form.register(field.key)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              Salva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SheetClient({ sheetKey }: { sheetKey: SheetKey }) {
  const config = sheetConfigs[sheetKey];
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [lookups, setLookups] = useState<LookupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState<RecordRow | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const tableFields = config.fields.filter((field) => field.table);
  const filterFields = config.fields.filter((field) => field.filter);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const [recordsResponse, lookupsResponse] = await Promise.all([
      fetch(`/api/records/${sheetKey}`, { cache: "no-store", signal }),
      fetch("/api/options", { cache: "no-store", signal })
    ]);
    const recordsPayload = await recordsResponse.json();
    const lookupsPayload = await lookupsResponse.json();

    if (signal?.aborted) return;

    if (!recordsResponse.ok) {
      setError(recordsPayload.error ?? "Impossibile caricare il foglio");
      setRecords([]);
    } else {
      setRecords(recordsPayload.records ?? []);
    }

    if (lookupsResponse.ok) {
      setLookups(lookupsPayload);
    }

    setLoading(false);
  }, [sheetKey]);

  useEffect(() => {
    const controller = new AbortController();
    setRecords([]);
    setFilters({});
    setSorting([]);
    setDialogOpen(false);
    setActiveRecord(null);
    setSavingCell(null);
    load(controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setError(error instanceof Error ? error.message : "Impossibile caricare il foglio");
      setLoading(false);
    });
    const refresh = () => load();
    const globalSearch = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      setQuery(customEvent.detail ?? "");
    };
    window.addEventListener("governance:data-refresh", refresh);
    window.addEventListener("governance:global-search", globalSearch);
    return () => {
      controller.abort();
      window.removeEventListener("governance:data-refresh", refresh);
      window.removeEventListener("governance:global-search", globalSearch);
    };
  }, [load]);

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (!rowMatchesSearch(record, config.fields, query)) return false;
      return filterFields.every((field) => matchesFilter(record, field, filters[field.key] ?? ""));
    });
  }, [records, config.fields, query, filterFields, filters]);

  const patchCell = useCallback(async (id: string, key: string, value: unknown) => {
    setSavingCell(`${id}:${key}`);
    const response = await fetch(`/api/records/${sheetKey}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Salvataggio non riuscito");
    } else {
      setRecords(payload.records ?? []);
      setError(null);
      window.dispatchEvent(new Event("governance:data-refresh"));
    }
    setSavingCell(null);
  }, [sheetKey]);

  async function saveRecord(values: RecordFormValues) {
    const response = await fetch(activeRecord ? `/api/records/${sheetKey}/${activeRecord.id}` : `/api/records/${sheetKey}`, {
      method: activeRecord ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Salvataggio non riuscito");
      return;
    }
    setRecords(payload.records ?? []);
    setError(null);
    window.dispatchEvent(new Event("governance:data-refresh"));
  }

  const removeRecord = useCallback(async (record: RecordRow) => {
    const label = displayValue(record, tableFields[1] ?? tableFields[0]);
    if (!window.confirm(`Eliminare "${label || record.id}"?`)) return;
    const response = await fetch(`/api/records/${sheetKey}/${record.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Eliminazione non riuscita");
      return;
    }
    setRecords(payload.records ?? []);
    window.dispatchEvent(new Event("governance:data-refresh"));
  }, [sheetKey, tableFields]);

  const columns = useMemo<ColumnDef<RecordRow>[]>(() => {
    return [
      ...tableFields.map<ColumnDef<RecordRow>>((field) => ({
        id: field.key,
        accessorFn: (row) => displayValue(row, field),
        header: ({ column }) => (
          <button type="button" className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span>{field.label}</span>
            <ArrowDownUp className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="relative" style={{ minWidth: field.width ? `${field.width}px` : undefined }}>
            <EditableCell row={row.original} field={field} records={records} lookups={lookups} onSave={patchCell} />
            {savingCell === `${row.original.id}:${field.key}` ? <Loader2 className="absolute right-1 top-2 size-3 animate-spin text-muted-foreground" /> : null}
          </div>
        )
      })),
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Apri dettaglio"
              onClick={() => {
                setActiveRecord(row.original);
                setDialogOpen(true);
              }}
            >
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon" title="Elimina" onClick={() => removeRecord(row.original)}>
              <Trash2 />
            </Button>
          </div>
        )
      }
    ];
  }, [tableFields, records, lookups, savingCell, patchCell, removeRecord]);

  const table = useReactTable({
    data: filteredRecords,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-normal sm:text-2xl">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Aggiorna
          </Button>
          <Button
            className="w-full sm:w-auto"
            size="sm"
            onClick={() => {
              setActiveRecord(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            Nuovo
          </Button>
        </div>
      </div>

      <Card className="border-0 bg-transparent shadow-none md:border md:bg-card md:shadow-sm">
        <CardContent className="space-y-3 p-0 md:p-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <Input className="h-9 w-full xl:w-72" placeholder="Cerca nel foglio" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap">
              {filterFields.map((field) => {
                const options = fieldOptions(field, lookups, records);
                return (
                  <select
                    key={field.key}
                    className="h-9 min-w-0 rounded-md border bg-background px-2 text-xs shadow-sm xl:min-w-36"
                    value={filters[field.key] ?? ""}
                    onChange={(event) => setFilters((current) => ({ ...current, [field.key]: event.target.value }))}
                  >
                    <option value="">{field.label}</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.label}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground xl:ml-auto">
              {filteredRecords.length} / {records.length} record
            </div>
          </div>

          {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

          <MobileRecordCards
            rows={table.getRowModel().rows.map((row) => row.original)}
            fields={tableFields}
            loading={loading}
            recordsCount={records.length}
            onEdit={(record) => {
              setActiveRecord(record);
              setDialogOpen(true);
            }}
            onRemove={removeRecord}
          />

          <div className="hidden rounded-md border md:block">
            <Table className="min-w-max">
              <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading && records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      Nessun record.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RecordDialog
        open={dialogOpen}
        mode={activeRecord ? "edit" : "create"}
        record={activeRecord}
        fields={config.fields}
        records={records}
        lookups={lookups}
        onOpenChange={setDialogOpen}
        onSubmit={saveRecord}
      />
    </div>
  );
}
