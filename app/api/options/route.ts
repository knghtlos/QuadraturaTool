import { NextResponse } from "next/server";
import { getLookups } from "@/lib/repository";

export async function GET() {
  try {
    return NextResponse.json(await getLookups());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore inatteso" }, { status: 500 });
  }
}
