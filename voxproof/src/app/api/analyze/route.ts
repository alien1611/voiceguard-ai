import { NextRequest, NextResponse } from "next/server";
import { generateMockResult } from "@/lib/api/mockAdapter";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file payload supplied." },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file exceeds maximum 25 MB payload threshold." },
        { status: 413 }
      );
    }

    // Proxy to live FastAPI if enabled
    if (process.env.NEXT_PUBLIC_USE_MOCK === "false") {
      try {
        const liveRes = await fetch("http://127.0.0.1:8000/api/predict", {
          method: "POST",
          body: formData,
        });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          return NextResponse.json(liveData);
        }
      } catch {}
    }

    // Default deterministic mock
    const result = generateMockResult(file.name, file.size);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to process audio analysis." },
      { status: 500 }
    );
  }
}
