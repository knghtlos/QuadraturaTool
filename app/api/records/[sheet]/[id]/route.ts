import { NextRequest, NextResponse } from "next/server";
import { assertSheetKey, deleteRecord, getRecords, updateRecord } from "@/lib/repository";

type RouteContext = {
  params: Promise<{ sheet: string; id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { sheet, id } = await context.params;
    assertSheetKey(sheet);
    const body = (await request.json()) as Record<string, unknown>;
    await updateRecord(sheet, id, body);
    const records = await getRecords(sheet);
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore inatteso" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { sheet, id } = await context.params;
    assertSheetKey(sheet);
    await deleteRecord(sheet, id);
    const records = await getRecords(sheet);
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore inatteso" }, { status: 400 });
  }
}
