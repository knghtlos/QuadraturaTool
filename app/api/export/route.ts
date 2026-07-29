import { NextResponse } from "next/server";
import { buildWorkbookBuffer } from "@/lib/workbook";

export async function GET() {
  try {
    const buffer = await buildWorkbookBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Quadrature Tool export.xlsx"`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore inatteso" }, { status: 500 });
  }
}
