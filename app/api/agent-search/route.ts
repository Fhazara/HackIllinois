import { NextRequest, NextResponse } from "next/server";

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ProductSearchResult {
    name: string;
    price: number | null;
    source: string;
    url: string;
    imageUrl: string;
    condition: string | null;
    matchNote?: string;
}

interface AgentSearchResponse {
    query: string;
    budget: number | null;
    resultCount: number;
    results: ProductSearchResult[];
}

/**
 * POST /api/agent-search
 * Sends a product search query to the OpenClaw agent and returns results.
 *
 * Body: { query: string, budget?: number }
 * Returns: { results: ProductSearchResult[] }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, budget } = body;

        // Validate and sanitize inputs
        if (!query || typeof query !== "string" || query.trim().length === 0) {
            return NextResponse.json(
                { error: "Missing or invalid required field: query" },
                { status: 400 },
            );
        }

        const parsedBudget = budget ? parseFloat(budget.toString()) : null;

        // Execute the python script inside the running Docker container using execFile (safe from shell injection)
        const args = [
            "exec",
            "thrift-product-agent",
            "python3",
            "/home/node/.openclaw/workspace/skills/product-search/search.py",
            "--query",
            query.trim()
        ];

        if (parsedBudget && !isNaN(parsedBudget)) {
            args.push("--budget", parsedBudget.toString());
        }

        console.log(`Executing Docker Scraper with args:`, args);
        // We set maxBuffer to 10MB to accommodate large JSON outputs from OpenClaw
        const { stdout, stderr } = await execFileAsync("docker", args, { maxBuffer: 1024 * 1024 * 10 });

        if (stderr && !stdout) {
            console.error("Docker Scraper stderr:", stderr);
        }

        // Parse the JSON output from the python script
        const searchResData = JSON.parse(stdout);

        return NextResponse.json({
            results: searchResData.results || [],
        });
    } catch (error: any) {
        console.error("OpenClaw Docker Agent Error:", error);
        return NextResponse.json(
            { error: "Failed to search for products" },
            { status: 500 },
        );
    }
}

/**
 * Extract product results from the agent's response.
 * The agent may return results embedded in its message as JSON.
 */
function extractResults(agentData: Record<string, unknown>): ProductSearchResult[] {
    try {
        // The agent's response text may contain a JSON block
        const responseText = String(agentData.message || agentData.response || agentData.content || "");

        // Try to find a JSON block in the response
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
            responseText.match(/\{[\s\S]*"results"[\s\S]*\}/);

        if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonStr) as AgentSearchResponse;
            if (Array.isArray(parsed.results)) {
                return parsed.results;
            }
        }

        // If the entire response is valid JSON
        if (responseText.trim().startsWith("{") || responseText.trim().startsWith("[")) {
            const parsed = JSON.parse(responseText);
            if (Array.isArray(parsed.results)) {
                return parsed.results as ProductSearchResult[];
            }
            if (Array.isArray(parsed)) {
                return parsed as ProductSearchResult[];
            }
        }

        return [];
    } catch {
        return [];
    }
}
