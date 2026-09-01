import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth-session";
import { getServerSupabase } from "@/lib/server-supabase";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  try {
    const customerId = Number((await context.params).id);
    if (!Number.isInteger(customerId) || customerId <= 0) return NextResponse.json({ error: "Некорректный ID заказчика" }, { status: 400 });
    const body = await request.json();
    const amount = Number(body?.amount);
    const description = String(body?.description ?? "Пополнение баланса").trim() || "Пополнение баланса";
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Сумма должна быть больше нуля" }, { status: 400 });
    const { data, error } = await getServerSupabase().rpc("top_up_customer_balance", {
      p_customer_id: customerId,
      p_amount: amount,
      p_description: description,
    });
    if (error) throw error;
    return NextResponse.json({ balance: Number(data) });
  } catch (error) {
    console.error("Ошибка пополнения баланса заказчика:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось пополнить баланс" }, { status: 500 });
  }
}
