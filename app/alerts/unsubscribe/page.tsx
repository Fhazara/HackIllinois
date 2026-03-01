import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";

// Server component to handle unsubscription
export default async function UnsubscribePage({
    searchParams,
}: {
    searchParams: { id?: string };
}) {
    const { id } = await searchParams;

    let success = false;
    let message = "Invalid unsubscribe link.";

    if (id) {
        try {
            const subscription = await prisma.alertSubscription.findUnique({
                where: { id },
            });

            if (subscription) {
                if (!subscription.isActive) {
                    message = "You are already unsubscribed from this alert.";
                    success = true;
                } else {
                    await prisma.alertSubscription.update({
                        where: { id },
                        data: { isActive: false },
                    });
                    message = "You have been successfully unsubscribed from this alert.";
                    success = true;
                }
            } else {
                message = "Alert subscription not found.";
            }
        } catch (e) {
            console.error("Unsubscribe error:", e);
            message = "An error occurred while trying to unsubscribe.";
        }
    }

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            textAlign: "center",
            background: "#fdfbz4",
            backgroundColor: "rgba(250, 244, 232, 0.95)",
        }}>
            <div style={{
                background: "#fff",
                padding: "40px 60px",
                borderRadius: 16,
                boxShadow: "0 10px 40px rgba(26, 18, 8, 0.08)",
                maxWidth: 500,
                width: "100%",
                border: "1px solid rgba(155, 130, 96, 0.15)",
            }}>
                <div style={{
                    fontSize: "3rem",
                    marginBottom: 20,
                    color: success ? "#2e7d32" : "#e65100"
                }}>
                    {success ? "✓" : "⚠️"}
                </div>

                <h1 style={{
                    fontFamily: "var(--font-playfair), serif",
                    fontSize: "1.8rem",
                    color: "#1a1208",
                    margin: "0 0 16px",
                }}>
                    {success ? "Unsubscribed" : "Failed to Unsubscribe"}
                </h1>

                <p style={{
                    fontFamily: "var(--font-caveat), cursive",
                    fontSize: "1.3rem",
                    color: "#6b5a3e",
                    margin: "0 0 32px",
                    lineHeight: 1.4,
                }}>
                    {message}
                </p>

                <Link href="/" style={{
                    display: "inline-block",
                    padding: "12px 24px",
                    background: "#9b8260",
                    color: "#fff",
                    textDecoration: "none",
                    borderRadius: 8,
                    fontFamily: "var(--font-playfair), serif",
                    fontWeight: 500,
                    transition: "opacity 0.2s",
                }}>
                    Back to Thrift Search
                </Link>
            </div>
        </div>
    );
}
