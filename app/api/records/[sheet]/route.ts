import { NextRequest, NextResponse } from "next/server";
import { assertSheetKey, createRecord, getRecords } from "@/lib/repository";

type RouteContext = {
  params: Promise<{ sheet: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { sheet } = await context.params;
    assertSheetKey(sheet);
    const records = await getRecords(sheet);
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore inatteso" }, { status: 400 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sheet } = await context.params;
    assertSheetKey(sheet);
    const body = (await request.json()) as Record<string, unknown>;
    await createRecord(sheet, body);
    const records = await getRecords(sheet);
    return NextResponse.json({ records }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore inatteso" }, { status: 400 });
  }
}
