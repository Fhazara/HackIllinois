import { NextRequest, NextResponse } from "next/server";

const MODAL_CHAT_URL = process.env.MODAL_CHAT_URL;

/**
 * POST /api/chat
 * Proxies messages to the Modal Product Research LLM.
 *
 * Body: { messages: [{role, content}], supermemory_context?: string }
 * Returns: { reply, needs_more_info, product_description, image_prompt }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, supermemory_context } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "messages array is required and must not be empty" },
                { status: 400 },
            );
        }

        if (!MODAL_CHAT_URL) {
            return NextResponse.json(
                { error: "MODAL_CHAT_URL is not configured" },
                { status: 503 },
            );
        }

        const response = await fetch(`${MODAL_CHAT_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages,
                supermemory_context: supermemory_context || "",
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Modal chat error:", response.status, errorText);
            return NextResponse.json(
                { error: "LLM chat failed", details: errorText },
                { status: 502 },
            );
        }

        const data = await response.json();

        // Strip the XML tags from the reply for clean display
        let cleanReply = data.reply || "";
        cleanReply = cleanReply.replace(/<product_description>[\s\S]*?<\/product_description>/g, "").trim();

        return NextResponse.json({
            reply: cleanReply,
            needs_more_info: data.needs_more_info,
            product_description: data.product_description,
            image_prompt: data.image_prompt,
        });
    } catch (error) {
        console.error("Chat proxy error:", error);
        return NextResponse.json(
            { error: "Failed to process chat" },
            { status: 500 },
        );
    }
}
