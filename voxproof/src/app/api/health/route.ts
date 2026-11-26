import { NextResponse } from "next/server";
import { getMockHealth } from "@/lib/api/mockAdapter";

export async function GET() {
  if (process.env.NEXT_PUBLIC_USE_MOCK !== "false") {
    return NextResponse.json(getMockHealth());
  }

  try {
    const res = await fetch("http://127.0.0.1:8000/api/health", {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(getMockHealth());
  }
}
