import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, phone, query, budget } = body;

        if (!query) {
            return NextResponse.json(
                { error: "Search query is required to create an alert." },
                { status: 400 },
            );
        }

        if (!email && !phone) {
            return NextResponse.json(
                { error: "Must provide either an email or phone number." },
                { status: 400 },
            );
        }

        const subscription = await prisma.alertSubscription.create({
            data: {
                query,
                budget: budget ? parseFloat(budget) : null,
                email: email || null,
                phone: phone || null,
            },
        });

        return NextResponse.json({ success: true, id: subscription.id });
    } catch (e) {
        console.error("Failed to create alert subscription:", e);
        return NextResponse.json(
            { error: "Failed to create subscription" },
            { status: 500 },
        );
    }
}
