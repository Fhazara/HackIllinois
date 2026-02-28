import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/search-requests/[id] — get a specific search request with results
export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;

        const searchRequest = await prisma.searchRequest.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, email: true, name: true } },
                results: { orderBy: { createdAt: "desc" } },
            },
        });

        if (!searchRequest) {
            return NextResponse.json(
                { error: "Search request not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(searchRequest);
    } catch (error) {
        console.error("Failed to fetch search request:", error);
        return NextResponse.json(
            { error: "Failed to fetch search request" },
            { status: 500 }
        );
    }
}

// PATCH /api/search-requests/[id] — update a search request
// Body: { title?, description?, budget?, status? }
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { title, description, budget, status } = body;

        // Validate status if provided
        const validStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
                { status: 400 }
            );
        }

        const data: Record<string, unknown> = {};
        if (title !== undefined) data.title = title;
        if (description !== undefined) data.description = description;
        if (budget !== undefined) data.budget = budget ? parseFloat(budget) : null;
        if (status !== undefined) data.status = status;

        const searchRequest = await prisma.searchRequest.update({
            where: { id },
            data,
            include: {
                user: { select: { id: true, email: true, name: true } },
                results: { orderBy: { createdAt: "desc" } },
            },
        });

        return NextResponse.json(searchRequest);
    } catch (error) {
        console.error("Failed to update search request:", error);
        return NextResponse.json(
            { error: "Failed to update search request" },
            { status: 500 }
        );
    }
}

// DELETE /api/search-requests/[id] — delete a search request
export async function DELETE(_request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;

        await prisma.searchRequest.delete({ where: { id } });

        return NextResponse.json({ message: "Search request deleted" });
    } catch (error) {
        console.error("Failed to delete search request:", error);
        return NextResponse.json(
            { error: "Failed to delete search request" },
            { status: 500 }
        );
    }
}
