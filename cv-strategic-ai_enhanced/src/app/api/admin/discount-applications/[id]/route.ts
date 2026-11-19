import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, apiError } from "@/lib/admin/controller";
import { reviewDiscountSchema } from "@/lib/discounts/model";
import { DiscountService } from "@/lib/discounts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const service = new DiscountService();
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireAdmin();
  if (access.error) return access.error;
  const parsed = reviewDiscountSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid review decision.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const application = await service.review((await context.params).id, access.user.id, parsed.data);
    return NextResponse.json({ application }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
