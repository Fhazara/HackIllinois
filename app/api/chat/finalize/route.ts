import { NextRequest, NextResponse } from "next/server";

const MODAL_CHAT_URL = process.env.MODAL_CHAT_URL;

/**
 * POST /api/chat/finalize
 * Calls the Modal LLM's finalize endpoint to lock in the product description.
 *
 * Body: { messages: [{role, content}] }
 * Returns: { reply, product_description, summary_for_supermemory }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "messages array is required" },
                { status: 400 },
            );
        }

        if (!MODAL_CHAT_URL) {
            return NextResponse.json(
                { error: "MODAL_CHAT_URL is not configured" },
                { status: 503 },
            );
        }

        const response = await fetch(`${MODAL_CHAT_URL}/finalize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Modal finalize error:", response.status, errorText);
            return NextResponse.json(
                { error: "Finalize failed", details: errorText },
                { status: 502 },
            );
        }

        const data = await response.json();

        let cleanReply = data.reply || "";
        cleanReply = cleanReply
            .replace(/<product_description>[\s\S]*?<\/product_description>/g, "")
            .replace(/<summary>[\s\S]*?<\/summary>/g, "")
            .trim();

        return NextResponse.json({
            reply: cleanReply,
            product_description: data.product_description,
            summary_for_supermemory: data.summary_for_supermemory,
        });
    } catch (error) {
        console.error("Finalize proxy error:", error);
        return NextResponse.json(
            { error: "Failed to finalize" },
            { status: 500 },
        );
    }
}
