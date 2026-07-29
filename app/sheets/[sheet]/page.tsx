import { notFound } from "next/navigation";
import { SheetClient } from "@/components/sheet-client";
import { isSheetKey } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export default async function SheetPage({ params }: { params: Promise<{ sheet: string }> }) {
  const { sheet } = await params;
  if (!isSheetKey(sheet)) notFound();
  return <SheetClient key={sheet} sheetKey={sheet} />;
}
