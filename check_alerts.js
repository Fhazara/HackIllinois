/* 
 * THRIFT LOCAL CRON ORCHESTRATOR
 * 
 * Since OpenClaw and Next.js are currently running locally on your machine (via Docker and localhost:3000), 
 * a cloud serverless function like Modal cannot access them directly. 
 * 
 * Run this script locally in a new terminal tab to trigger the 15-minute alert checks!
 * Usage: node check_alerts.js
 */

const http = require("http");

console.log("=========================================");
console.log(" Thrift Local Scheduler Started          ");
console.log(" Checking for new items every 15 minutes ");
console.log("=========================================\n");

function triggerCron() {
    console.log(`[${new Date().toLocaleTimeString()}] Triggering Alert Check API...`);

    const req = http.request(
        {
            hostname: "localhost",
            port: 3000,
            path: "/api/alerts/cron",
            method: "GET",
        },
        (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.success) {
                        console.log(`[✓] Success: Processed ${parsed.processed || 0} active subscriptions.\n`);
                    } else {
                        console.error("[x] API Error:", parsed.error || "Unknown error.\n");
                    }
                } catch (e) {
                    console.error("[x] Failed to parse API response.\n");
                }
            });
        }
    );

    req.on("error", (e) => {
        console.error(`[!] Failed to connect to Next.js server. Is it running on localhost:3000? Error: ${e.message}\n`);
    });

    req.end();
}

// Run immediately on boot
triggerCron();

// Run every 15 minutes (900000 ms)
setInterval(triggerCron, 15 * 60 * 1000);
