import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/search-requests/[id]/results — list results for a search request
export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;

        // Verify the search request exists
        const searchRequest = await prisma.searchRequest.findUnique({
            where: { id },
        });

        if (!searchRequest) {
            return NextResponse.json(
                { error: "Search request not found" },
                { status: 404 }
            );
        }

        const results = await prisma.productResult.findMany({
            where: { searchRequestId: id },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error("Failed to fetch results:", error);
        return NextResponse.json(
            { error: "Failed to fetch results" },
            { status: 500 }
        );
    }
}

// POST /api/search-requests/[id]/results — add a result to a search request
// Body: { name, price?, url, imageUrl?, source?, matchNotes? }
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { name, price, url, imageUrl, source, matchNotes } = body;

        if (!name || !url) {
            return NextResponse.json(
                { error: "name and url are required" },
                { status: 400 }
            );
        }

        // Verify the search request exists
        const searchRequest = await prisma.searchRequest.findUnique({
            where: { id },
        });

        if (!searchRequest) {
            return NextResponse.json(
                { error: "Search request not found" },
                { status: 404 }
            );
        }

        const result = await prisma.productResult.create({
            data: {
                name,
                price: price ? parseFloat(price) : null,
                url,
                imageUrl: imageUrl || null,
                source: source || null,
                matchNotes: matchNotes || null,
                searchRequestId: id,
            },
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        console.error("Failed to create result:", error);
        return NextResponse.json(
            { error: "Failed to create result" },
            { status: 500 }
        );
    }
}
