import { NextRequest, NextResponse } from "next/server";
import { importWorkbook } from "@/lib/workbook";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File XLSX mancante." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = await importWorkbook(buffer);

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore inatteso" }, { status: 400 });
  }
}
