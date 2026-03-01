"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

interface Message {
    role: "user" | "assistant";
    content: string;
    /** Base64 image data (user message with photo for identification/tagging) */
    image?: string;
    image_mime?: string;
}

interface ProductDescription {
    ready: boolean;
    name: string;
    category: string;
    brand: string;
    colorway?: string;
    size?: string;
    condition?: string;
    max_price?: number;
    keywords: string[];
    image_prompt: string;
    /** When present, use these 3 distinct prompts for the reference images (different styles/variations). */
    image_prompts?: string[];
}

type Phase = "chat" | "images" | "searching" | "done";

function SearchPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get("q") || "";

    const [phase, setPhase] = useState<Phase>("chat");
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [productDesc, setProductDesc] = useState<ProductDescription | null>(null);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [removedImages, setRemovedImages] = useState<Set<number>>(new Set());
    // Track load state per image: 'pending' | 'loaded' | 'error'. Options show only when all have settled.
    const [imageLoadStates, setImageLoadStates] = useState<("pending" | "loaded" | "error")[]>([]);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasSentInitial = useRef(false);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // If user lands on /search with no query and no stored image, send them to home first
    useEffect(() => {
        if (!initialQuery && messages.length === 0 && typeof window !== "undefined" && !sessionStorage.getItem("searchImage")) {
            router.replace("/");
        }
    }, [initialQuery, messages.length, router]);

    // Send initial query (and optional image) when arriving from home
    useEffect(() => {
        if (!hasSentInitial.current && (initialQuery || (typeof window !== "undefined" && sessionStorage.getItem("searchImage")))) {
            hasSentInitial.current = true;
            const imageB64 = typeof window !== "undefined" ? sessionStorage.getItem("searchImage") : null;
            const imageMime = typeof window !== "undefined" ? sessionStorage.getItem("searchImageMime") : null;
            const prompt = typeof window !== "undefined" ? sessionStorage.getItem("searchImagePrompt") : null;
            const text = initialQuery || prompt || "What is this? Find items like this.";
            if (imageB64) {
                sessionStorage.removeItem("searchImage");
                sessionStorage.removeItem("searchImageMime");
                sessionStorage.removeItem("searchImagePrompt");
            }
            sendMessage(text, imageB64 || undefined, imageMime || undefined);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialQuery]);

    async function sendMessage(text: string, imageBase64?: string, imageMime?: string) {
        const userMsg: Message = { role: "user", content: text, ...(imageBase64 && { image: imageBase64, image_mime: imageMime || "image/jpeg" }) };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: updatedMessages }),
            });

            if (!res.ok) throw new Error("Chat request failed");

            const data = await res.json();
            const assistantMsg: Message = { role: "assistant", content: data.reply };
            setMessages([...updatedMessages, assistantMsg]);

            // If the LLM is done asking questions
            if (!data.needs_more_info && data.product_description) {
                setProductDesc(data.product_description);
                // Generate reference images and wait for them to preload
                await generateImages(data.product_description);
            }
        } catch (err) {
            const errorMsg: Message = {
                role: "assistant",
                content: "Sorry, something went wrong. Please try again.",
            };
            setMessages([...updatedMessages, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    }

    async function generateImages(desc: ProductDescription) {
        setPhase("images");
        // Use 3 distinct prompts from Scout when available (different styles/variations); else fallback
        const prompts =
            desc.image_prompts && desc.image_prompts.length >= 3
                ? desc.image_prompts.slice(0, 3)
                : [
                      desc.image_prompt,
                      `${desc.name} ${desc.brand || ""} product photo`,
                      `${desc.category} ${desc.colorway || ""} styled flat lay`,
                  ];

        const urls: string[] = [];
        for (const prompt of prompts) {
            const url = `/api/generate-image?q=${encodeURIComponent(prompt)}&seed=${Math.floor(Math.random() * 10000)}`;
            urls.push(url);
        }

        setGeneratedImages(urls);
        setImageLoadStates(urls.map(() => "pending" as const));
    }

    function markImageLoadState(index: number, state: "loaded" | "error") {
        setImageLoadStates((prev) => {
            const next = [...prev];
            if (index >= 0 && index < next.length) next[index] = state;
            return next;
        });
    }

    const imagesReady =
        imageLoadStates.length > 0 && imageLoadStates.every((s) => s !== "pending");

    function toggleRemoveImage(index: number) {
        setRemovedImages((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    }

    async function confirmAndSearch() {
        if (!productDesc) return;
        setPhase("searching");

        try {
            // Finalize the product description
            await fetch("/api/chat/finalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages }),
            });

            // Search using name, tags, and Scout keywords (preferences); avoid anti_preferences in query
            const searchParts = [
                productDesc.name,
                productDesc.brand,
                productDesc.category,
                productDesc.colorway,
                productDesc.condition,
                productDesc.keywords?.join(" "),
            ].filter(Boolean) as string[];
            const searchQuery = searchParts.join(" ").trim() || productDesc.name;

            const searchRes = await fetch("/api/agent-search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: searchQuery,
                    budget: productDesc.max_price,
                }),
            });

            if (searchRes.ok) {
                const searchResData = await searchRes.json();
                sessionStorage.setItem("latestSearchResults", JSON.stringify({
                    query: productDesc.name,
                    description: `${productDesc.brand || ""} ${productDesc.category || ""} ${productDesc.colorway || ""} ${productDesc.condition || ""}`.trim(),
                    budget: productDesc.max_price,
                    results: searchResData.results || [],
                    status: "COMPLETED"
                }));
                setPhase("done");
                router.push(`/results?q=${encodeURIComponent(productDesc.name)}`);
            } else {
                // Fallback: navigate to results with query
                setPhase("done");
                router.push(`/results?q=${encodeURIComponent(productDesc.name)}`);
            }
        } catch {
            setPhase("done");
            router.push(`/results?q=${encodeURIComponent(productDesc.name)}`);
        }
    }

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <header
                style={{
                    padding: "24px 40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(155, 130, 96, 0.15)",
                }}
            >
                <button
                    onClick={() => router.push("/")}
                    style={{
                        background: "none",
                        border: "none",
                        fontFamily: "var(--font-caveat), cursive",
                        fontSize: "1rem",
                        color: "#9b8260",
                        cursor: "pointer",
                    }}
                >
                    ← back home
                </button>
                <h1
                    style={{
                        fontFamily: "var(--font-playfair), 'Playfair Display', serif",
                        fontSize: "1.3rem",
                        fontStyle: "italic",
                        fontWeight: 400,
                        color: "#1a1208",
                        margin: 0,
                    }}
                >
                    {phase === "chat"
                        ? "tell us what you're looking for"
                        : phase === "images"
                            ? "do these look right?"
                            : phase === "searching"
                                ? "searching everywhere..."
                                : "all done!"}
                </h1>
                <div style={{ width: 100 }} />
            </header>

            {/* ── Chat Phase ── */}
            {(phase === "chat" || (phase === "images" && messages.length > 0)) && (
                <div
                    style={{
                        flex: phase === "images" ? "0 0 auto" : 1,
                        maxHeight: phase === "images" ? 300 : undefined,
                        overflowY: "auto",
                        padding: "24px 40px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                    }}
                >
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            style={{
                                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                                maxWidth: "70%",
                                padding: "12px 18px",
                                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                background:
                                    msg.role === "user"
                                        ? "rgba(155, 130, 96, 0.15)"
                                        : "rgba(250, 244, 232, 0.8)",
                                boxShadow: "0 1px 4px rgba(26, 18, 8, 0.06)",
                            }}
                        >
                            {msg.role === "user" && msg.image && (
                                <img
                                    src={`data:${msg.image_mime || "image/jpeg"};base64,${msg.image}`}
                                    alt="Uploaded"
                                    style={{
                                        width: 120,
                                        height: 120,
                                        objectFit: "cover",
                                        borderRadius: 8,
                                        marginBottom: 8,
                                        display: "block",
                                    }}
                                />
                            )}
                            <p
                                style={{
                                    margin: 0,
                                    fontFamily:
                                        msg.role === "user"
                                            ? "var(--font-caveat), cursive"
                                            : "var(--font-playfair), 'Playfair Display', serif",
                                    fontSize: msg.role === "user" ? "1.1rem" : "0.95rem",
                                    color: "#1a1208",
                                    lineHeight: 1.5,
                                }}
                            >
                                {msg.content}
                            </p>
                        </div>
                    ))}

                    {isLoading && (
                        <div
                            style={{
                                alignSelf: "flex-start",
                                padding: "12px 18px",
                                borderRadius: "18px 18px 18px 4px",
                                background: "rgba(250, 244, 232, 0.8)",
                            }}
                        >
                            <span className="typing-dots" style={{ fontFamily: "var(--font-caveat), cursive", color: "#9b8260" }}>
                                thinking...
                            </span>
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>
            )}

            {/* ── Chat Input ── */}
            {phase === "chat" && (
                <div
                    style={{
                        padding: "16px 40px 28px",
                        borderTop: "1px solid rgba(155, 130, 96, 0.1)",
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-end",
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && input.trim() && !isLoading && sendMessage(input.trim())}
                        placeholder="describe what you're looking for..."
                        autoFocus
                        style={{
                            flex: 1,
                            fontFamily: "var(--font-playfair), 'Playfair Display', serif",
                            fontSize: "1rem",
                            fontStyle: "italic",
                            background: "transparent",
                            border: "none",
                            borderBottom: "1.5px solid #9b8260",
                            outline: "none",
                            color: "#1a1208",
                            caretColor: "#9b8260",
                            paddingBottom: 8,
                        }}
                    />
                    <button
                        onClick={() => input.trim() && !isLoading && sendMessage(input.trim())}
                        disabled={!input.trim() || isLoading}
                        style={{
                            background: "none",
                            border: "none",
                            color: input.trim() && !isLoading ? "#9b8260" : "#ccc",
                            fontSize: "1.6rem",
                            cursor: input.trim() && !isLoading ? "pointer" : "default",
                            paddingBottom: 4,
                            transition: "transform 0.2s",
                        }}
                    >
                        →
                    </button>
                </div>
            )}

            {/* ── Images Phase ── */}
            {phase === "images" && (
                <div style={{ flex: 1, padding: "24px 40px" }}>
                    {!imagesReady ? (
                        <p
                            style={{
                                fontFamily: "var(--font-caveat), cursive",
                                fontSize: "1.1rem",
                                color: "#8b7355",
                                marginBottom: 20,
                                textAlign: "center",
                            }}
                        >
                            creating your reference images...
                        </p>
                    ) : (
                        <p
                            style={{
                                fontFamily: "var(--font-caveat), cursive",
                                fontSize: "1.1rem",
                                color: "#8b7355",
                                marginBottom: 20,
                                textAlign: "center",
                            }}
                        >
                            here&apos;s what we think you mean — tap to remove any that don&apos;t match
                        </p>
                    )}

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 20,
                            maxWidth: 800,
                            margin: "0 auto 32px",
                        }}
                    >
                        {generatedImages.map((url, i) => {
                            const isRemoved = removedImages.has(i);
                            const loadState = imageLoadStates[i] ?? "pending";
                            return (
                                <div
                                    key={i}
                                    onClick={() => toggleRemoveImage(i)}
                                    style={{
                                        position: "relative",
                                        borderRadius: 8,
                                        overflow: "hidden",
                                        cursor: "pointer",
                                        opacity: isRemoved ? 0.3 : 1,
                                        transform: isRemoved ? "scale(0.95)" : "scale(1)",
                                        transition: "opacity 0.3s, transform 0.3s",
                                        boxShadow: "0 2px 10px rgba(26, 18, 8, 0.1)",
                                        background: "#e8dfd0",
                                        aspectRatio: "1",
                                    }}
                                >
                                    {loadState === "pending" && (
                                        <div
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                background: "rgba(155, 130, 96, 0.12)",
                                            }}
                                        >
                                            <div
                                                className="search-spinner"
                                                style={{ width: 32, height: 32, borderWidth: 2 }}
                                            />
                                        </div>
                                    )}
                                    {loadState === "error" && (
                                        <img
                                            src="https://placehold.co/400x400/e8dfd0/9b8260?text=Reference"
                                            alt="Reference"
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                            }}
                                        />
                                    )}
                                    {(loadState === "loaded" || loadState === "pending") && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img
                                            src={url}
                                            alt={`Reference ${i + 1}`}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                display: loadState === "pending" ? "none" : "block",
                                            }}
                                            onLoad={() => markImageLoadState(i, "loaded")}
                                            onError={() => markImageLoadState(i, "error")}
                                        />
                                    )}
                                    {isRemoved && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                background: "rgba(26, 18, 8, 0.4)",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontFamily: "var(--font-caveat), cursive",
                                                    fontSize: "1.4rem",
                                                    color: "#fff",
                                                }}
                                            >
                                                removed ✕
                                            </span>
                                        </div>
                                    )}
                                    {!isRemoved && loadState === "loaded" && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: 8,
                                                right: 8,
                                                width: 28,
                                                height: 28,
                                                borderRadius: "50%",
                                                background: "rgba(46, 125, 50, 0.85)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "#fff",
                                                fontSize: "0.9rem",
                                            }}
                                        >
                                            ✓
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Product summary + button only after all images have loaded or failed */}
                    {imagesReady && (
                        <>
                            {productDesc && (
                                <div
                                    style={{
                                        maxWidth: 500,
                                        margin: "0 auto 28px",
                                        background: "rgba(250, 244, 232, 0.7)",
                                        borderRadius: 10,
                                        padding: "20px 24px",
                                        boxShadow: "0 2px 8px rgba(26, 18, 8, 0.06)",
                                    }}
                                >
                                    <h3
                                        style={{
                                            fontFamily: "var(--font-playfair), 'Playfair Display', serif",
                                            fontSize: "1.15rem",
                                            fontWeight: 500,
                                            color: "#1a1208",
                                            margin: "0 0 12px",
                                        }}
                                    >
                                        {productDesc.name}
                                    </h3>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                                        {productDesc.brand && <Tag label={productDesc.brand} />}
                                        {productDesc.category && <Tag label={productDesc.category} />}
                                        {productDesc.size && <Tag label={productDesc.size} />}
                                        {productDesc.colorway && <Tag label={productDesc.colorway} />}
                                        {productDesc.condition && <Tag label={productDesc.condition} />}
                                    </div>
                                    {productDesc.max_price && (
                                        <p
                                            style={{
                                                fontFamily: "var(--font-caveat), cursive",
                                                fontSize: "1.1rem",
                                                color: "#2e7d32",
                                                margin: "8px 0 0",
                                            }}
                                        >
                                            budget: ${productDesc.max_price}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div style={{ textAlign: "center" }}>
                                <button
                                    onClick={confirmAndSearch}
                                    style={{
                                        fontFamily: "var(--font-playfair), 'Playfair Display', serif",
                                        fontSize: "1.05rem",
                                        fontStyle: "italic",
                                        background: "#1a1208",
                                        color: "#faf4e8",
                                        border: "none",
                                        borderRadius: 28,
                                        padding: "14px 40px",
                                        cursor: "pointer",
                                        transition: "transform 0.2s, box-shadow 0.2s",
                                        boxShadow: "0 4px 16px rgba(26, 18, 8, 0.18)",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(26, 18, 8, 0.24)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = "translateY(0)";
                                        e.currentTarget.style.boxShadow = "0 4px 16px rgba(26, 18, 8, 0.18)";
                                    }}
                                >
                                    looks good — find me deals →
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Searching Phase ── */}
            {phase === "searching" && (
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 24,
                        padding: 40,
                    }}
                >
                    <div className="search-spinner" />
                    <p
                        style={{
                            fontFamily: "var(--font-playfair), 'Playfair Display', serif",
                            fontSize: "1.2rem",
                            fontStyle: "italic",
                            color: "#1a1208",
                            textAlign: "center",
                        }}
                    >
                        scouring eBay, Depop, Poshmark, Etsy...
                    </p>
                    <p
                        style={{
                            fontFamily: "var(--font-caveat), cursive",
                            fontSize: "1rem",
                            color: "#9b8260",
                        }}
                    >
                        this might take a minute
                    </p>
                </div>
            )}

            {/* ── Animations ── */}
            <style jsx>{`
        .typing-dots::after {
          content: "";
          animation: dots 1.5s steps(4) infinite;
        }
        @keyframes dots {
          0% { content: ""; }
          25% { content: "."; }
          50% { content: ".."; }
          75% { content: "..."; }
        }
        .search-spinner {
          width: 48px;
          height: 48px;
          border: 3px solid rgba(155, 130, 96, 0.2);
          border-top: 3px solid #9b8260;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}

/* ── Default export with Suspense boundary ── */
export default function SearchPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "1.2rem", color: "#9b8260" }}>loading...</p>
            </div>
        }>
            <SearchPageContent />
        </Suspense>
    );
}

/* ── Helper component ── */
function Tag({ label }: { label: string }) {
    return (
        <span
            style={{
                fontFamily: "var(--font-caveat), cursive",
                fontSize: "0.9rem",
                color: "#6b5a3e",
                background: "rgba(155, 130, 96, 0.12)",
                borderRadius: 12,
                padding: "3px 12px",
            }}
        >
            {label}
        </span>
    );
}
