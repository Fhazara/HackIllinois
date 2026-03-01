import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exec } from "child_process";
import { promisify } from "util";
import Mailjet from "node-mailjet";

const mailjet = new Mailjet({
    apiKey: "b17aecb4ee1ad7d4f66a13c1a79e2ba0",
    apiSecret: "4f9c07825df8de5b11ceb0af1d5b4b55"
});

const execAsync = promisify(exec);

export async function GET() {
    try {
        console.log("CRON: Starting 15-minute alert check...");

        const activeAlerts = await prisma.alertSubscription.findMany({
            where: { is_active: true },
            include: { seen_items: true }
        });

        console.log(`CRON: Found ${activeAlerts.length} active subscriptions.`);

        await Promise.all(activeAlerts.map(async (alert) => {
            console.log(`CRON: Checking new items for query "${alert.query}"`);

            const command = `docker exec thrift-product-agent python3 /home/node/.openclaw/workspace/skills/product-search/search.py --query "${alert.query.replace(/"/g, '\\"')}" --sort-new` +
                (alert.budget ? ` --budget ${alert.budget}` : "");

            try {
                const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });

                let parsedData;
                try {
                    const startIndex = stdout.indexOf("{");
                    const endIndex = stdout.lastIndexOf("}");
                    if (startIndex !== -1 && endIndex !== -1) {
                        const jsonStr = stdout.substring(startIndex, endIndex + 1);
                        parsedData = JSON.parse(jsonStr);
                    } else {
                        parsedData = {};
                    }
                } catch (e) {
                    console.error("Failed to parse docker stdout in Cron:", e);
                    parsedData = {};
                }

                const results = parsedData.results || [];

                const seenUrls = new Set(alert.seen_items.map((s: any) => s.url));
                const newItems = results.filter((item: any) => item.url && !seenUrls.has(item.url));

                if (newItems.length > 0) {
                    console.log(`CRON: Found ${newItems.length} new items!`);

                    await prisma.seenItem.createMany({
                        data: newItems.map((idx: any) => ({
                            url: idx.url,
                            subscription_id: alert.id
                        })),
                        skipDuplicates: true
                    });

                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
                    const unsubscribeUrl = `${appUrl}/alerts/unsubscribe?id=${alert.id}`;
                    const resultsUrl = `${appUrl}/results?q=${encodeURIComponent(alert.query)}`;

                    const emailTitle = `We found ${newItems.length} new thrift finds for "${alert.query}"!`;
                    let topFinds = newItems.slice(0, 3).map((n: any) => `- ${n.name} ($${n.price}): ${n.url}`).join("\n");

                    const emailBody = `
========================================
NEW ALERTS FROM THRIFT!
========================================
We found ${newItems.length} new listings matching your search: "${alert.query}". 
Prices hover around $${alert.budget || "Any"}.

Top Finds:
${topFinds}

View all your matching listings instantly:
${resultsUrl}

----------------------------------------
To stop receiving these alerts, click here:
${unsubscribeUrl}
========================================
`;

                    const smsBody = `[THRIFT ALERT] ${newItems.length} new finds for "${alert.query}"! View here: ${resultsUrl} | Reply STOP to unsubscribe.`;

                    console.log(`\n=== MOCK EMAIL FALLBACK TO TERMINAL ===\n${emailBody}\n=======================================\n`);

                    if (alert.email) {
                        try {
                            console.log(`Sending Mailjet email to: ${alert.email}...`);
                            await mailjet.post("send", { version: "v3.1" }).request({
                                Messages: [
                                    {
                                        From: {
                                            Email: process.env.MAILJET_SENDER_EMAIL || "thrift.ai.alerts@gmail.com",
                                            Name: "Thrift AI Alerts",
                                        },
                                        To: [
                                            {
                                                Email: alert.email,
                                                Name: alert.email.split("@")[0],
                                            },
                                        ],
                                        Subject: emailTitle,
                                        TextPart: emailBody,
                                    },
                                ],
                            });
                            console.log(`✅ Mailjet email successfully sent to ${alert.email}!`);
                        } catch (err: any) {
                            console.error("❌ Mailjet failed:", err.statusCode, err.response?.data || err.message);
                            console.log("If 401/403: Ensure your sender email is verified in the Mailjet dashboard.");
                        }
                    }

                    if (alert.phone) console.log(`Mock SMS sent to: ${alert.phone}\nMessage: ${smsBody}`);

                    await prisma.alertSubscription.update({
                        where: { id: alert.id },
                        data: { last_checked_at: new Date() }
                    });
                } else {
                    console.log(`CRON: No new items found for "${alert.query}".`);
                }
            } catch (err) {
                console.error(`CRON: Docker exec failed for query "${alert.query}":`, err);
            }
        }));

        return NextResponse.json({ success: true, processed: activeAlerts.length });
    } catch (e: any) {
        console.error("CRON failed:", e);
        return NextResponse.json({ error: "Cron run failed", details: e.toString(), stack: e.stack }, { status: 500 });
    }
}
