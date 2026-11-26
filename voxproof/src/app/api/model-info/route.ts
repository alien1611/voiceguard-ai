import { NextResponse } from "next/server";
import { getMockModelInfo } from "@/lib/api/mockAdapter";

export async function GET() {
  if (process.env.NEXT_PUBLIC_USE_MOCK !== "false") {
    return NextResponse.json(getMockModelInfo());
  }

  try {
    const res = await fetch("http://127.0.0.1:8000/api/model-info", {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(getMockModelInfo());
  }
}
