import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/rooms/propose/catalog/channel3";
import { parseWorkspaceCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/search
 *
 * Query parameters:
 * - q: search query string
 * - limit: number of results (max 20)
 * - category: optional category filter
 * - max_price_cents: optional maximum price in integer cents
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const category = searchParams.get("category") || undefined;
    const limitParam = searchParams.get("limit");
    const maxPriceParam = searchParams.get("max_price_cents");

    const parsedLimit = limitParam ? parseInt(limitParam, 10) : 10;
    const limit = isNaN(parsedLimit) ? 10 : Math.min(Math.max(parsedLimit, 1), 20);

    const parsedMaxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : undefined;
    const maxPriceCents = parsedMaxPrice && !isNaN(parsedMaxPrice) ? parsedMaxPrice : undefined;

    // Optional workspace scoping check if cookie is present
    const cookieHeader = request.headers.get("cookie");
    const workspaceId = parseWorkspaceCookie(cookieHeader);

    const searchResult = await searchProducts(query, {
      limit,
      category,
      maxPriceCents,
    });

    return NextResponse.json({
      success: true,
      workspace_id: workspaceId,
      ...searchResult,
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute product search",
      },
      { status: 500 }
    );
  }
}
