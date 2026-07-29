"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImportExportActions() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    window.location.href = "/api/export";
  }

  function handleImport(file: File | undefined) {
    if (!file) return;
    setMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/import", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Import non riuscito");
        return;
      }
      const imported = payload.summary?.sheets?.reduce((sum: number, sheet: { imported: number }) => sum + sheet.imported, 0) ?? 0;
      setMessage(`${imported} righe importate`);
      window.dispatchEvent(new Event("governance:data-refresh"));
    });
  }

  return (
    <div className="grid min-w-0 grid-cols-2 items-center gap-2 sm:flex sm:shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(event) => handleImport(event.target.files?.[0])}
      />
      <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isPending} title="Import XLSX">
        <Upload />
        Import
      </Button>
      <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={handleExport} title="Export XLSX">
        <Download />
        Export
      </Button>
      {message ? <span className="col-span-2 truncate text-xs text-muted-foreground sm:max-w-52 md:inline">{message}</span> : null}
    </div>
  );
}
