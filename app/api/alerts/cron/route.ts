import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Vercel Cron or Modal Cron entrypoint
export async function GET() {
    try {
        console.log("CRON: Starting 15-minute alert check...");

        const activeAlerts = await prisma.alertSubscription.findMany({
            where: { isActive: true },
            include: { seenItems: true }
        });

        console.log(`CRON: Found ${activeAlerts.length} active subscriptions.`);

        for (const alert of activeAlerts) {
            console.log(`CRON: Checking new items for query "${alert.query}"`);

            // Execute the scraper
            const command = `docker exec thrift-product-agent python3 /home/node/.openclaw/workspace/skills/product-search/search.py --query "${alert.query.replace(/"/g, '\\"')}"` +
                (alert.budget ? ` --budget ${alert.budget}` : "");

            const { stdout } = await execAsync(command);

            // The scraper script might output some logs from OpenClaw via print(),
            // so we look for the last valid JSON object line.
            let parsedData;
            try {
                const outputStr = stdout.trim();
                const lines = outputStr.split("\n");
                // The expected output will be a JSON log starting with { "results": [...] }
                const jsonLine = lines.find((line) => line.startsWith("{"));
                parsedData = jsonLine ? JSON.parse(jsonLine) : {};
            } catch (e) {
                console.error("Failed to parse docker stdout in Cron:", e);
                parsedData = {};
            }

            const results = parsedData.results || [];

            // Isolate new items
            const seenUrls = new Set(alert.seenItems.map((s) => s.url));
            const newItems = results.filter((item: any) => item.url && !seenUrls.has(item.url));

            if (newItems.length > 0) {
                console.log(`CRON: Found ${newItems.length} new items for alert ${alert.id}!`);

                // 1. Save these items so we don't alert on them again
                await prisma.seenItem.createMany({
                    data: newItems.map((idx: any) => ({
                        url: idx.url,
                        subscriptionId: alert.id
                    })),
                    skipDuplicates: true
                });

                // 2. Draft the Message
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
                const unsubscribeUrl = `${appUrl}/alerts/unsubscribe?id=${alert.id}`;
                const resultsUrl = `${appUrl}/results?q=${encodeURIComponent(alert.query)}`;

                const emailTitle = `We found ${newItems.length} new thrift finds for "${alert.query}"!`;
                let topFinds = newItems.slice(0, 3).map((n: any) => `- ${n.name} ($${n.price}): ${n.url}`).join("\n");

                const emailBody = `
========================================
NEW ALERTS FROM THRIFT!
========================================
We've been keeping an eye out, and we found ${newItems.length} new listings matching your search: "${alert.query}". 
Prices hover around $${alert.budget || "Any"}.

Top Finds:
${topFinds}

View all your matching listings instantly:
${resultsUrl}

----------------------------------------
To stop receiving these alerts, simply click here:
${unsubscribeUrl}
========================================
`;

                const smsBody = `[THRIFT ALERT] We found ${newItems.length} new finds for "${alert.query}"! View them here: ${resultsUrl} | Reply STOP to unsubscribe.`;

                // 3. Dispatch the Notifications (using Mock Console.log as approved)
                if (alert.email) {
                    console.log(`Mock Email sent to: ${alert.email}\nSubject: ${emailTitle}\nBody: ${emailBody}`);
                }
                if (alert.phone) {
                    console.log(`Mock SMS sent to: ${alert.phone}\nMessage: ${smsBody}`);
                }

                // Keep Last Checked updated
                await prisma.alertSubscription.update({
                    where: { id: alert.id },
                    data: { lastCheckedAt: new Date() }
                })
            } else {
                console.log(`CRON: No new items found for "${alert.query}".`);
            }
        }

        return NextResponse.json({ success: true, processed: activeAlerts.length });
    } catch (e) {
        console.error("CRON failed:", e);
        return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
    }
}
