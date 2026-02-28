"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const scrapbookItems = [
  { id: 0, src: "/jeans.png", label: "jeans", top: "3%", left: "1%", rotation: -11, duration: 10.0, delay: 0, w: 172, h: 212 },
  { id: 1, src: "/shirt.png", label: "shirt", top: "2%", left: "17%", rotation: 4, duration: 11.5, delay: 1.4, w: 178, h: 218 },
  { id: 2, src: "/tank_top.png", label: "tank top", top: "1%", left: "36%", rotation: -5, duration: 13.0, delay: 0.6, w: 170, h: 210 },
  { id: 3, src: "/candle.png", label: "candle", top: "5%", left: "55%", rotation: 8, duration: 10.8, delay: 2.2, w: 176, h: 216 },
  { id: 4, src: "/vase.png", label: "vase", top: "2%", left: "calc(93% - 173px)", rotation: -4, duration: 12.5, delay: 3.0, w: 173, h: 213 },
  { id: 5, src: "/slacks.png", label: "slacks", top: "30%", left: "0%", rotation: -16, duration: 11.0, delay: 1.2, w: 180, h: 220 },
  { id: 6, src: "/lamp1.png", label: "lamp", top: "42%", left: "11%", rotation: 6, duration: 12.0, delay: 0.3, w: 174, h: 214 },
  { id: 7, src: "/dress.png", label: "dress", top: "28%", left: "calc(98% - 177px)", rotation: 9, duration: 10.5, delay: 1.8, w: 177, h: 217 },
  { id: 8, src: "/lamp2.png", label: "lamp", top: "52%", left: "calc(90% - 171px)", rotation: -7, duration: 13.5, delay: 2.8, w: 171, h: 211 },
  { id: 9, src: "/bomber_jacket.png", label: "bomber jacket", top: "calc(98% - 215px)", left: "2%", rotation: 5, duration: 11.2, delay: 2.5, w: 175, h: 215 },
  { id: 10, src: "/blazer.png", label: "blazer", top: "calc(96% - 219px)", left: "20%", rotation: -8, duration: 12.8, delay: 0.6, w: 179, h: 219 },
  { id: 11, src: "/cami.png", label: "cami", top: "calc(99% - 213px)", left: "42%", rotation: 12, duration: 11.8, delay: 1.7, w: 173, h: 213 },
  { id: 12, src: "/top.png", label: "top", top: "calc(97% - 216px)", left: "calc(86% - 176px)", rotation: -13, duration: 10.3, delay: 3.4, w: 176, h: 216 },
];

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [exploded, setExploded] = useState(false);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number }>>({});
  const [dragOrder, setDragOrder] = useState(scrapbookItems.map((i) => i.id));
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number; startX: number; startY: number } | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setExploded(true), 80);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { id, offsetX, offsetY, startX, startY } = dragRef.current;
      if (!didDragRef.current) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.sqrt(dx * dx + dy * dy) > 4) didDragRef.current = true;
      }
      setPositions((prev) => ({ ...prev, [id]: { x: e.clientX - offsetX, y: e.clientY - offsetY } }));
    };
    const onMouseUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>, id: number, el: HTMLDivElement) => {
    e.preventDefault();
    const startX = el.offsetLeft;
    const startY = el.offsetTop;
    setPositions((prev) => ({ ...prev, [id]: { x: startX, y: startY } }));
    setDragOrder((prev) => [...prev.filter((i) => i !== id), id]);
    didDragRef.current = false;
    dragRef.current = { id, offsetX: e.clientX - startX, offsetY: e.clientY - startY, startX: e.clientX, startY: e.clientY };
  };

  const onClickItem = (label: string) => {
    if (!didDragRef.current) setQuery(label);
  };

  const sortedItems = [...scrapbookItems].sort(
    (a, b) => dragOrder.indexOf(a.id) - dragOrder.indexOf(b.id)
  );

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {sortedItems.map((item) => {
        const pos = positions[item.id];
        const isDragged = pos !== undefined;
        const stagger = `${item.id * 35}ms`;
        const easing = "cubic-bezier(0.34, 1.3, 0.64, 1)";

        return (
          <div
            key={item.id}
            onMouseDown={(e) => onMouseDown(e, item.id, e.currentTarget)}
            onMouseUp={() => onClickItem(item.label)}
            style={{
              position: "absolute",
              ...(isDragged
                ? { left: pos.x, top: pos.y }
                : exploded
                  ? { left: item.left, top: item.top }
                  : { left: `calc(50% - ${item.w / 2}px)`, top: `calc(50% - ${item.h / 2}px)` }),
              transform: `rotate(${item.rotation}deg)`,
              zIndex: dragOrder.indexOf(item.id) + 1,
              cursor: dragRef.current?.id === item.id ? "grabbing" : "grab",
              userSelect: "none",
              transition: isDragged
                ? "none"
                : `left 0.55s ${easing} ${stagger}, top 0.55s ${easing} ${stagger}`,
            }}
          >
            {/* Float animation wrapper */}
            <div
              className={!isDragged ? "floating-item" : ""}
              style={
                {
                  "--duration": `${item.duration}s`,
                  "--delay": `${item.delay}s`,
                } as React.CSSProperties
              }
            >
              <Image
                src={item.src}
                alt={item.label}
                width={item.w}
                height={item.h}
                style={{ objectFit: "cover", display: "block", pointerEvents: "none" }}
                draggable={false}
              />
            </div>
          </div>
        );
      })}

      {/* Center content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, pointerEvents: "auto" }}>
          <h1
            style={{
              fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
              fontSize: "clamp(2rem, 4vw, 3.4rem)",
              fontStyle: "italic",
              fontWeight: 400,
              color: "#1a1208",
              textAlign: "center",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            what do you want to buy?
          </h1>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && query.trim() && router.push(`/search?q=${encodeURIComponent(query)}`)}
              placeholder="a vintage leather jacket..."
              autoFocus
              style={{
                fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
                fontSize: "1.1rem",
                fontStyle: "italic",
                background: "transparent",
                border: "none",
                borderBottom: "1.5px solid #9b8260",
                outline: "none",
                color: "#1a1208",
                caretColor: "#9b8260",
                paddingBottom: 6,
                width: 288,
              }}
            />
            <button
              onClick={() => query.trim() && router.push(`/search?q=${encodeURIComponent(query)}`)}
              style={{
                background: "none",
                border: "none",
                color: "#9b8260",
                fontSize: "1.6rem",
                lineHeight: 1,
                paddingBottom: 4,
                cursor: "pointer",
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateX(4px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateX(0)")}
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
