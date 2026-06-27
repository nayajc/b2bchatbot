import { NextRequest, NextResponse } from "next/server";
import { getAgencyContext } from "@/lib/auth/getAgencyContext";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const context = await getAgencyContext(token);
  return NextResponse.json(context);
}
