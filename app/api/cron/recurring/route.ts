import { NextResponse } from "next/server";
import { runRecurringEngine } from "@/lib/recurring-engine";

function checkCronSecret(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

export async function GET(request: Request) {

  try {

    if (!checkCronSecret(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await runRecurringEngine();

    return NextResponse.json({
      success: true,
      message: "Recurring cron executed"
    });

  } catch (err: any) {

    console.error("CRON ERROR:", err);

    return NextResponse.json(
      { error: err.message || "Cron failed" },
      { status: 500 }
    );
  }
}