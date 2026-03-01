"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

/* ── Sample results — will be replaced by API data once functionality is wired ── */
const sampleResults = [
    {
        id: 1,
        name: "Vintage Levi 501 Jeans",
        price: 45,
        source: "eBay",
        url: "https://ebay.com",
        image: "/jeans.png",
        matchNote: "90s medium wash, 32×30 — great condition, minimal distressing",
        rotation: -3,
    },
    {
        id: 2,
        name: "Oversized Bomber Jacket",
        price: 62,
        source: "Depop",
        url: "https://depop.com",
        image: "/bomber_jacket.png",
        matchNote: "Dark olive, fits oversized M/L, barely worn",
        rotation: 2,
    },
    {
        id: 3,
        name: "Linen Blend Blazer",
        price: 38,
        source: "Poshmark",
        url: "https://poshmark.com",
        image: "/blazer.png",
        matchNote: "Beige linen, relaxed fit, perfect for layering",
        rotation: -1.5,
    },
    {
        id: 4,
        name: "Ribbed Knit Tank Top",
        price: 18,
        source: "ThredUp",
        url: "https://thredup.com",
        image: "/tank_top.png",
        matchNote: "Cream colored, stretchy rib knit, size S",
        rotation: 3,
    },
    {
        id: 5,
        name: "Handmade Ceramic Vase",
        price: 55,
        source: "Etsy",
        url: "https://etsy.com",
        image: "/vase.png",
        matchNote: "Minimalist stone finish, 8\" tall, slight imperfections add character",
        rotation: -2,
    },
    {
        id: 6,
        name: "Cotton Button-Down Shirt",
        price: 28,
        source: "Facebook Marketplace",
        url: "https://facebook.com/marketplace",
        image: "/shirt.png",
        matchNote: "White oxford cloth, slightly oversized, rolled cuffs",
        rotation: 1.5,
    },
    {
        id: 7,
        name: "Pleated Midi Dress",
        price: 42,
        source: "Depop",
        url: "https://depop.com",
        image: "/dress.png",
        matchNote: "Off-white, elegant drape, fits true to size",
        rotation: -2.5,
    },
    {
        id: 8,
        name: "Soy Wax Candle Set",
        price: 24,
        source: "Etsy",
        url: "https://etsy.com",
        image: "/candle.png",
        matchNote: "Amber + sandalwood scent, 40hr burn time, black ceramic vessel",
        rotation: 2.5,
    },
    {
        id: 9,
        name: "Vintage Bedside Lamp",
        price: 35,
        source: "Craigslist",
        url: "https://craigslist.org",
        image: "/lamp1.png",
        matchNote: "Pleated fabric shade, ceramic base, warm glow",
        rotation: -1,
    },
    {
        id: 10,
        name: "Tailored Wool Slacks",
        price: 50,
        source: "eBay",
        url: "https://ebay.com",
        image: "/slacks.png",
        matchNote: "Charcoal gray, high rise, wide leg — vintage Armani",
        rotation: 3.5,
    },
    {
        id: 11,
        name: "Modern Desk Lamp",
        price: 68,
        source: "Facebook Marketplace",
        url: "https://facebook.com/marketplace",
        image: "/lamp2.png",
        matchNote: "Stacked stone base, globe silhouette, warm ambient light",
        rotation: -3.5,
    },
    {
        id: 12,
        name: "Off-Shoulder Cami Top",
        price: 22,
        source: "Poshmark",
        url: "https://poshmark.com",
        image: "/cami.png",
        matchNote: "Cream white, sleek fit, stretchy fabric",
        rotation: 1,
    },
];

const sourceColors: Record<string, string> = {
    eBay: "#e53935",
    Depop: "#ff6347",
    Poshmark: "#7b1fa2",
    ThredUp: "#2e7d32",
    Etsy: "#f4511e",
    "Facebook Marketplace": "#1877f2",
    Craigslist: "#5a2d82",
};

export default function ResultsPage() {
    const [hoveredId, setHoveredId] = useState<number | string | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [searchData, setSearchData] = useState<any>(null);
    const [imagesLoaded, setImagesLoaded] = useState<Record<string | number, boolean>>({});

    // Alert subscription state
    const [isAlertMenuOpen, setIsAlertMenuOpen] = useState(false);
    const [notifyEmail, setNotifyEmail] = useState("");
    const [notifyPhone, setNotifyPhone] = useState("");
    const [notifyStatus, setNotifyStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

    useEffect(() => {
        // Load real data from sessionStorage if available
        try {
            const stored = sessionStorage.getItem("latestSearchResults");
            if (stored) {
                setSearchData(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to parse stored search results", e);
        }

        const timer = setTimeout(() => setLoaded(true), 60);
        return () => clearTimeout(timer);
    }, []);

    // Fallback data structure for styling if accessed directly without searching
    const displayQuery = searchData || {
        query: "Vintage Levi 501 Jeans",
        description: "Looking for 90s Levi 501 jeans, size 32×30, medium wash. Prefer minimal distressing.",
        budget: 75,
        status: "IN_PROGRESS",
    };

    const displayResults = searchData?.results?.length > 0 ? searchData.results : sampleResults;

    const handleSubscribe = async () => {
        if (!notifyEmail && !notifyPhone) return;
        setNotifyStatus("loading");
        try {
            const res = await fetch("/api/alerts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: notifyEmail,
                    phone: notifyPhone,
                    query: displayQuery.query || displayQuery.description,
                    budget: displayQuery.budget,
                }),
            });
            if (res.ok) {
                setNotifyStatus("success");
                setTimeout(() => setIsAlertMenuOpen(false), 3000);
            } else {
                setNotifyStatus("error");
            }
        } catch {
            setNotifyStatus("error");
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                paddingBottom: 80,
            }}
        >
            {/* ── Header ── */}
            <header
                style={{
                    padding: "40px 48px 32px",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 24,
                }}
            >
                <div>
                    <Link
                        href="/"
                        style={{
                            fontFamily: "var(--font-caveat), cursive",
                            fontSize: "1rem",
                            color: "#9b8260",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 16,
                            transition: "color 0.2s",
                        }}
                    >
                        ← back to search
                    </Link>

                    <h1
                        style={{
                            fontFamily:
                                "var(--font-playfair), 'Playfair Display', Georgia, serif",
                            fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                            fontStyle: "italic",
                            fontWeight: 400,
                            color: "#1a1208",
                            lineHeight: 1.2,
                            margin: 0,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        we found {displayResults.length} things for you
                    </h1>
                    <p
                        style={{
                            fontFamily: "var(--font-caveat), cursive",
                            fontSize: "1.15rem",
                            color: "#8b7355",
                            marginTop: 8,
                            lineHeight: 1.4,
                        }}
                    >
                        &quot;{displayQuery.description}&quot;
                    </p>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        flexShrink: 0,
                    }}
                >
                    <div
                        style={{
                            background: "rgba(155, 130, 96, 0.12)",
                            borderRadius: 20,
                            padding: "8px 18px",
                            fontFamily: "var(--font-caveat), cursive",
                            fontSize: "1.05rem",
                            color: "#6b5a3e",
                        }}
                    >
                        budget: <strong>${displayQuery.budget || "Any"}</strong>
                    </div>
                    <div
                        style={{
                            background:
                                displayQuery.status === "COMPLETED"
                                    ? "rgba(46, 125, 50, 0.12)"
                                    : "rgba(245, 127, 23, 0.12)",
                            borderRadius: 20,
                            padding: "8px 18px",
                            fontFamily: "var(--font-caveat), cursive",
                            fontSize: "1.05rem",
                            color:
                                displayQuery.status === "COMPLETED" ? "#2e7d32" : "#e65100",
                        }}
                    >
                        {displayQuery.status === "COMPLETED"
                            ? "✓ search complete"
                            : "↻ still looking..."}
                    </div>
                    <div style={{ position: "relative" }}>
                        <button
                            onClick={() => setIsAlertMenuOpen(!isAlertMenuOpen)}
                            style={{
                                background: "rgba(155, 130, 96, 0.12)",
                                border: "none",
                                borderRadius: 20,
                                padding: "8px 18px",
                                fontFamily: "var(--font-caveat), cursive",
                                fontSize: "1.05rem",
                                color: "#6b5a3e",
                                cursor: "pointer",
                                transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(155, 130, 96, 0.2)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(155, 130, 96, 0.12)")}
                        >
                            🔔 notify me
                        </button>

                        {/* Dropdown Menu */}
                        {isAlertMenuOpen && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: "120%",
                                    right: 0,
                                    width: 320,
                                    background: "#fdfbz4",
                                    backgroundColor: "rgba(250, 244, 232, 0.95)",
                                    backdropFilter: "blur(10px)",
                                    boxShadow: "0 10px 30px rgba(26, 18, 8, 0.1)",
                                    borderRadius: 12,
                                    padding: 20,
                                    zIndex: 100,
                                    border: "1px solid rgba(155, 130, 96, 0.2)",
                                }}
                            >
                                <h4 style={{ margin: "0 0 12px", fontFamily: "var(--font-playfair), serif", color: "#1a1208", fontSize: "1.1rem" }}>
                                    get alerted
                                </h4>
                                <p style={{ margin: "0 0 16px", fontFamily: "var(--font-caveat), cursive", color: "#6b5a3e", fontSize: "1.05rem" }}>
                                    we check every 15 min for new listings matching this search!
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <input
                                        type="email"
                                        placeholder="email address"
                                        value={notifyEmail}
                                        onChange={(e) => setNotifyEmail(e.target.value)}
                                        style={{
                                            padding: "10px 14px",
                                            borderRadius: 6,
                                            border: "1px solid rgba(155, 130, 96, 0.3)",
                                            background: "rgba(255, 255, 255, 0.5)",
                                            fontFamily: "var(--font-playfair), serif",
                                            fontSize: "0.95rem",
                                        }}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="phone number (optional)"
                                        value={notifyPhone}
                                        onChange={(e) => setNotifyPhone(e.target.value)}
                                        style={{
                                            padding: "10px 14px",
                                            borderRadius: 6,
                                            border: "1px solid rgba(155, 130, 96, 0.3)",
                                            background: "rgba(255, 255, 255, 0.5)",
                                            fontFamily: "var(--font-playfair), serif",
                                            fontSize: "0.95rem",
                                        }}
                                    />
                                    <button
                                        onClick={handleSubscribe}
                                        disabled={notifyStatus === "loading" || notifyStatus === "success" || (!notifyEmail && !notifyPhone)}
                                        style={{
                                            padding: "10px",
                                            borderRadius: 6,
                                            border: "none",
                                            background: notifyStatus === "success" ? "#2e7d32" : "#9b8260",
                                            color: "#fff",
                                            fontFamily: "var(--font-playfair), serif",
                                            fontSize: "1rem",
                                            cursor: notifyStatus === "success" ? "default" : "pointer",
                                            marginTop: 4,
                                        }}
                                    >
                                        {notifyStatus === "loading" ? "subscribing..." : notifyStatus === "success" ? "✓ subscribed!" : "start tracking"}
                                    </button>
                                    {notifyStatus === "error" && (
                                        <p style={{ margin: 0, color: "#e65100", fontSize: "0.85rem", textAlign: "center" }}>failed to subscribe.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Masonry-style results grid ── */}
            <div
                style={{
                    columnCount: 3,
                    columnGap: 28,
                    padding: "0 48px",
                    maxWidth: 1400,
                    margin: "0 auto",
                }}
                className="results-grid"
            >
                {displayResults.map((item: any, index: number) => {
                    // OpenClaw might not return an id, so fallback to index
                    const uniqueId = item.id || index;
                    const isHovered = hoveredId === uniqueId;
                    const stagger = `${index * 60}ms`;
                    const color = sourceColors[item.source] || "#6b5a3e";

                    // Fallback to a placeholder image if OpenClaw didn't find one
                    const imgUrl = item.imageUrl || item.image || "https://images.unsplash.com/photo-1555529771-835f59bfc50c?w=500&q=80";

                    return (
                        <a
                            key={uniqueId}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onMouseEnter={() => setHoveredId(uniqueId)}
                            onMouseLeave={() => setHoveredId(null)}
                            style={{
                                display: "block",
                                breakInside: "avoid",
                                marginBottom: 28,
                                background: "rgba(250, 244, 232, 0.7)",
                                borderRadius: 6,
                                padding: 14,
                                boxShadow: isHovered
                                    ? "0 12px 32px rgba(26, 18, 8, 0.15), 0 2px 8px rgba(26, 18, 8, 0.08)"
                                    : "0 2px 8px rgba(26, 18, 8, 0.06), 0 1px 3px rgba(26, 18, 8, 0.04)",
                                transform: `rotate(${isHovered ? 0 : (item.rotation || 0)}deg) scale(${isHovered ? 1.02 : 1}) translateY(${loaded ? 0 : 40}px)`,
                                opacity: loaded ? 1 : 0,
                                transition: `transform 0.35s cubic-bezier(0.34, 1.3, 0.64, 1), 
                             box-shadow 0.3s ease, 
                             opacity 0.5s ease ${stagger}`,
                                cursor: "pointer",
                                textDecoration: "none",
                                color: "inherit",
                                position: "relative",
                            }}
                        >
                            {/* Tape decoration */}
                            <div
                                style={{
                                    position: "absolute",
                                    top: -8,
                                    left: "50%",
                                    transform: "translateX(-50%) rotate(-2deg)",
                                    width: 48,
                                    height: 16,
                                    background: "rgba(210, 190, 160, 0.5)",
                                    borderRadius: 2,
                                    zIndex: 2,
                                }}
                            />

                            {/* Image */}
                            <div
                                style={{
                                    borderRadius: 4,
                                    overflow: "hidden",
                                    marginBottom: 12,
                                    background: "#e8dfd0",
                                    position: "relative",
                                }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={imgUrl}
                                    alt={item.name}
                                    onLoad={() => setImagesLoaded(prev => ({ ...prev, [uniqueId]: true }))}
                                    style={{
                                        width: "100%",
                                        height: "auto",
                                        objectFit: "cover",
                                        display: "block",
                                        transition: "transform 0.4s ease, opacity 0.4s ease-in-out",
                                        transform: isHovered ? "scale(1.03)" : "scale(1)",
                                        opacity: imagesLoaded[uniqueId] ? 1 : 0,
                                    }}
                                />
                                {/* Source badge */}
                                <div
                                    style={{
                                        position: "absolute",
                                        bottom: 8,
                                        right: 8,
                                        background: color,
                                        color: "#fff",
                                        fontFamily: "var(--font-caveat), cursive",
                                        fontSize: "0.85rem",
                                        padding: "3px 10px",
                                        borderRadius: 12,
                                        letterSpacing: "0.02em",
                                    }}
                                >
                                    {item.source}
                                </div>
                            </div>

                            {/* Text content */}
                            <div>
                                <h3
                                    style={{
                                        fontFamily:
                                            "var(--font-playfair), 'Playfair Display', Georgia, serif",
                                        fontSize: "1.05rem",
                                        fontWeight: 500,
                                        color: "#1a1208",
                                        margin: "0 0 4px",
                                        lineHeight: 1.3,
                                    }}
                                >
                                    {item.name}
                                </h3>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        gap: 8,
                                        marginBottom: 6,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontFamily: "var(--font-caveat), cursive",
                                            fontSize: "1.35rem",
                                            fontWeight: 500,
                                            color:
                                                item.price && displayQuery.budget && item.price <= displayQuery.budget
                                                    ? "#2e7d32"
                                                    : "#1a1208",
                                        }}
                                    >
                                        {item.price ? `$${item.price}` : "See Site"}
                                    </span>
                                    {item.price && displayQuery.budget && item.price <= displayQuery.budget && (
                                        <span
                                            style={{
                                                fontFamily: "var(--font-caveat), cursive",
                                                fontSize: "0.8rem",
                                                color: "#2e7d32",
                                                opacity: 0.7,
                                            }}
                                        >
                                            under budget ✓
                                        </span>
                                    )}
                                </div>
                                <p
                                    style={{
                                        fontFamily: "var(--font-caveat), cursive",
                                        fontSize: "0.92rem",
                                        color: "#8b7355",
                                        lineHeight: 1.4,
                                        margin: 0,
                                    }}
                                >
                                    {item.matchNote}
                                </p>
                            </div>

                            {/* Hover indicator */}
                            <div
                                style={{
                                    marginTop: 10,
                                    textAlign: "center",
                                    fontFamily: "var(--font-caveat), cursive",
                                    fontSize: "0.85rem",
                                    color: "#9b8260",
                                    opacity: isHovered ? 1 : 0,
                                    transform: isHovered ? "translateY(0)" : "translateY(4px)",
                                    transition: "opacity 0.2s, transform 0.2s",
                                }}
                            >
                                view listing →
                            </div>
                        </a>
                    );
                })}
            </div>

            {/* ── Responsive column overrides ── */}
            <style jsx>{`
        @media (max-width: 1024px) {
          .results-grid {
            column-count: 2 !important;
            padding: 0 28px !important;
          }
        }
        @media (max-width: 640px) {
          .results-grid {
            column-count: 1 !important;
            padding: 0 16px !important;
          }
        }
      `}</style>
        </div>
    );
}
