import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SheetClient } from "@/components/sheet-client";
import { isSheetKey } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export default async function SheetPage({ params }: { params: Promise<{ sheet: string }> }) {
  const { sheet } = await params;
  if (!isSheetKey(sheet)) notFound();
  return (
    <Suspense fallback={<div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Caricamento foglio...</div>}>
      <SheetClient key={sheet} sheetKey={sheet} />
    </Suspense>
  );
}
