import { NextRequest, NextResponse } from "next/server";

const MODAL_URL = process.env.MODAL_URL;

// GET /api/generate-image?q=black+dunk+low&seed=42
// Proxies the request to the Modal image generation endpoint.
// Returns the generated PNG image.
export async function GET(request: NextRequest) {
    try {
        if (!MODAL_URL) {
            return NextResponse.json(
                { error: "MODAL_URL is not configured" },
                { status: 500 }
            );
        }

        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q");
        const seed = searchParams.get("seed");
        const debug = searchParams.get("debug");

        if (!q || !q.trim()) {
            return NextResponse.json(
                { error: "q (query) parameter is required" },
                { status: 400 }
            );
        }

        // Build the Modal URL with query params
        const modalUrl = new URL(MODAL_URL);
        modalUrl.searchParams.set("q", q);
        if (seed) modalUrl.searchParams.set("seed", seed);
        if (debug) modalUrl.searchParams.set("debug", "true");

        const response = await fetch(modalUrl.toString());

        if (!response.ok) {
            const text = await response.text();
            console.error("Modal API error:", response.status, text);
            return NextResponse.json(
                { error: "Image generation failed", details: text },
                { status: response.status }
            );
        }

        // If debug mode, return the JSON from Modal
        if (debug) {
            const json = await response.json();
            return NextResponse.json(json);
        }

        // Otherwise, proxy the PNG image back to the client
        const imageBuffer = await response.arrayBuffer();
        const genMs = response.headers.get("X-Gen-Ms");
        const prompt = response.headers.get("X-Prompt");

        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=3600",
                ...(genMs && { "X-Gen-Ms": genMs }),
                ...(prompt && { "X-Prompt": prompt }),
            },
        });
    } catch (error) {
        console.error("Failed to generate image:", error);
        return NextResponse.json(
            { error: "Failed to generate image" },
            { status: 500 }
        );
    }
}
