import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/search-requests — list all search requests
// Optional query params: ?status=PENDING&userEmail=user@example.com
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const userEmail = searchParams.get("userEmail");

        const where: Record<string, unknown> = {};
        if (status) {
            where.status = status;
        }
        if (userEmail) {
            where.user = { email: userEmail };
        }

        const searchRequests = await prisma.searchRequest.findMany({
            where,
            include: {
                user: { select: { id: true, email: true, name: true } },
                _count: { select: { results: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(searchRequests);
    } catch (error) {
        console.error("Failed to fetch search requests:", error);
        return NextResponse.json(
            { error: "Failed to fetch search requests" },
            { status: 500 }
        );
    }
}

// POST /api/search-requests — create a new search request
// Body: { title, description, budget?, userEmail, userName? }
// Automatically triggers AI image generation via Modal if MODAL_URL is configured.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, description, budget, userEmail, userName } = body;

        if (!title || !description || !userEmail) {
            return NextResponse.json(
                { error: "title, description, and userEmail are required" },
                { status: 400 }
            );
        }

        // Upsert user — create if they don't exist, otherwise just connect
        const user = await prisma.user.upsert({
            where: { email: userEmail },
            update: { name: userName || undefined },
            create: { email: userEmail, name: userName },
        });

        // Build the image URL if Modal is configured
        const modalUrl = process.env.MODAL_URL;
        let imageUrl: string | null = null;
        if (modalUrl && !modalUrl.includes("YOUR_MODAL_URL")) {
            // Use the proxy endpoint so the client can load the image directly
            const origin = new URL(request.url).origin;
            imageUrl = `${origin}/api/generate-image?q=${encodeURIComponent(title)}`;
        }

        const searchRequest = await prisma.searchRequest.create({
            data: {
                title,
                description,
                budget: budget ? parseFloat(budget) : null,
                imageUrl,
                userId: user.id,
            },
            include: {
                user: { select: { id: true, email: true, name: true } },
            },
        });

        return NextResponse.json(searchRequest, { status: 201 });
    } catch (error) {
        console.error("Failed to create search request:", error);
        return NextResponse.json(
            { error: "Failed to create search request" },
            { status: 500 }
        );
    }
}
