import { NextRequest, NextResponse } from "next/server";
import { getBillingOffer, getBillingOfferOptions } from "@/lib/repository";

export async function GET(request: NextRequest) {
  try {
    const query =
      request.nextUrl.searchParams.get("q")?.trim() ??
      request.nextUrl.searchParams.get("codice")?.trim() ??
      "";

    if (!query) {
      return NextResponse.json({ offers: await getBillingOfferOptions() });
    }

    const payload = await getBillingOffer(query);
    if (!payload) {
      return NextResponse.json({ error: `Offerta non trovata per codice o nome "${query}"` }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore inatteso" }, { status: 500 });
  }
}
