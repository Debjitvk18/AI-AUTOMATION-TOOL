"use client";

import { ChevronRightIcon } from "@radix-ui/react-icons";
import * as Color from "color-bits";
import { motion } from "motion/react";
import Link from "next/link";
import { Bot, Orbit, ShieldCheck, Sparkles, Workflow, Zap } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/cn";

type FooterLinkGroup = {
  title: string;
  links: Array<{ id: number; title: string; url: string }>;
};

const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Product",
    links: [
      { id: 1, title: "Workflow Canvas", url: "/workflow" },
      { id: 2, title: "Automation Runs", url: "/workflow" },
      { id: 3, title: "Live Tracking", url: "/workflow" },
      { id: 4, title: "API Triggers", url: "/workflow" },
    ],
  },
  {
    title: "Platform",
    links: [
      { id: 5, title: "Security", url: "/" },
      { id: 6, title: "Reliability", url: "/" },
      { id: 7, title: "Scalability", url: "/" },
      { id: 8, title: "Roadmap", url: "/" },
    ],
  },
  {
    title: "Resources",
    links: [
      { id: 9, title: "Documentation", url: "/" },
      { id: 10, title: "Guides", url: "/" },
      { id: 11, title: "Community", url: "/" },
      { id: 12, title: "Support", url: "/" },
    ],
  },
];

const trustBadges = [
  { id: "ai", label: "AI Ready", icon: Bot },
  { id: "secure", label: "Secure by Default", icon: ShieldCheck },
  { id: "fast", label: "Realtime", icon: Zap },
  { id: "visual", label: "Visual Builder", icon: Workflow },
  { id: "smart", label: "Smart Nodes", icon: Sparkles },
  { id: "orchestrate", label: "Orchestrated", icon: Orbit },
] as const;

export const getRGBA = (cssColor: React.CSSProperties["color"], fallback = "rgba(180,180,180,1)"): string => {
  if (typeof window === "undefined") return fallback;
  if (!cssColor) return fallback;

  try {
    if (typeof cssColor === "string" && cssColor.startsWith("var(")) {
      const element = document.createElement("div");
      element.style.color = cssColor;
      document.body.appendChild(element);
      const computedColor = window.getComputedStyle(element).color;
      document.body.removeChild(element);
      return Color.formatRGBA(Color.parse(computedColor));
    }

    return Color.formatRGBA(Color.parse(cssColor));
  } catch {
    return fallback;
  }
};

export const colorWithOpacity = (color: string, opacity: number): string => {
  if (!color.startsWith("rgb")) return color;
  return Color.formatRGBA(Color.alpha(Color.parse(color), opacity));
};

interface FlickeringGridProps extends React.HTMLAttributes<HTMLDivElement> {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  maxOpacity?: number;
  text?: string;
  fontSize?: number;
}

function FlickeringGrid({
  squareSize = 3,
  gridGap = 3,
  flickerChance = 0.18,
  color = "#6B7280",
  maxOpacity = 0.34,
  text = "AUTOMATE",
  fontSize = 96,
  className,
  ...props
}: FlickeringGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textMaskRef = useRef<Uint8Array>(new Uint8Array(0));

  const memoizedColor = useMemo(() => getRGBA(color), [color]);

  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      cols: number,
      rows: number,
      squares: Float32Array,
      textMask: Uint8Array,
    ) => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const x = i * (squareSize + gridGap);
          const y = j * (squareSize + gridGap);
          const hasText = textMask[i * rows + j] === 1;
          const opacity = hasText ? Math.min(1, squares[i * rows + j] * 2.4 + 0.32) : squares[i * rows + j];
          ctx.fillStyle = colorWithOpacity(memoizedColor, opacity);
          ctx.fillRect(x, y, squareSize, squareSize);
        }
      }
    },
    [gridGap, memoizedColor, squareSize],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let raf = 0;
    let cols = 0;
    let rows = 0;
    let squares = new Float32Array(0);

    const setup = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(width / (squareSize + gridGap));
      rows = Math.ceil(height / (squareSize + gridGap));
      squares = new Float32Array(cols * rows);
      textMaskRef.current = new Uint8Array(cols * rows);

      for (let i = 0; i < squares.length; i += 1) {
        squares[i] = Math.random() * maxOpacity;
      }

      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
      if (!maskCtx) return;

      maskCtx.clearRect(0, 0, width, height);
      maskCtx.fillStyle = "white";
      maskCtx.font = `700 ${fontSize}px var(--font-display), var(--font-sans), sans-serif`;
      maskCtx.textAlign = "center";
      maskCtx.textBaseline = "middle";
      maskCtx.fillText(text, width / 2, height / 2);

      const maskPixels = maskCtx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const px = Math.min(width - 1, Math.floor(i * (squareSize + gridGap) + squareSize / 2));
          const py = Math.min(height - 1, Math.floor(j * (squareSize + gridGap) + squareSize / 2));
          const index = (py * width + px) * 4 + 3;
          textMaskRef.current[i * rows + j] = maskPixels[index] > 0 ? 1 : 0;
        }
      }
    };

    setup();

    let last = 0;
    const frame = (time: number) => {
      const dt = Math.max((time - last) / 1000, 0.016);
      last = time;

      for (let i = 0; i < squares.length; i += 1) {
        if (Math.random() < flickerChance * dt) {
          squares[i] = Math.random() * maxOpacity;
        }
      }

      drawGrid(ctx, canvas.width, canvas.height, cols, rows, squares, textMaskRef.current);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    const observer = new ResizeObserver(setup);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [drawGrid, flickerChance, fontSize, gridGap, maxOpacity, squareSize, text]);

  return (
    <div ref={containerRef} className={cn("h-full w-full", className)} {...props}>
      <canvas ref={canvasRef} className="pointer-events-none h-full w-full" />
    </div>
  );
}

export function FlickeringFooter() {
  return (
    <footer className="relative mt-20 overflow-hidden rounded-3xl border border-(--nf-border) bg-white/78 shadow-[0_34px_100px_rgba(2,6,23,0.13)] backdrop-blur-xl dark:bg-[#0f1014]/85">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(34,211,238,0.28),transparent_36%),radial-gradient(circle_at_86%_14%,rgba(14,165,233,0.24),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.18),transparent_42%)]" />

      <div className="relative grid gap-10 p-8 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="space-y-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/45 bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
            NextFlow Platform
          </div>

          <div>
            <h3 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-(--nf-text) sm:text-4xl">
              Build once.
              <br />
              Ship reliable automations forever.
            </h3>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-(--nf-muted) sm:text-base">
              Designed for AI-native teams that need speed, observability, and production-grade reliability without
              sacrificing product quality.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {trustBadges.map((badge, index) => {
              const Icon = badge.icon;
              return (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.42, delay: index * 0.05 }}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200/45 bg-white/80 px-3 py-2 text-xs font-medium text-(--nf-text) shadow-[0_8px_16px_rgba(8,47,73,0.08)] dark:border-cyan-400/20 dark:bg-cyan-500/5"
                >
                  <Icon className="h-4 w-4 text-cyan-500" />
                  {badge.label}
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="space-y-8">
          <div className="rounded-2xl border border-cyan-200/45 bg-white/80 p-5 shadow-[0_12px_30px_rgba(14,116,144,0.12)] dark:border-cyan-400/20 dark:bg-cyan-500/5">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-cyan-600 dark:text-cyan-300">
              Ready to launch
            </p>
            <p className="mt-2 text-sm leading-relaxed text-(--nf-muted)">
              Turn idea to running workflow in minutes with reusable nodes, API triggers, and live execution tracking.
            </p>
            <Link
              href="/workflow"
              className="group mt-4 inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(14,116,144,0.3)] transition hover:-translate-y-0.5"
            >
              Open Workflow Builder
              <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {footerLinkGroups.map((group) => (
              <ul key={group.title} className="space-y-2">
                <li className="pb-2 text-xs font-semibold tracking-[0.13em] uppercase text-(--nf-text)">{group.title}</li>
                {group.links.map((link) => (
                  <li key={link.id} className="group">
                    <Link
                      href={link.url}
                      className="inline-flex items-center gap-2 text-sm text-(--nf-muted) transition hover:text-(--nf-text)"
                    >
                      {link.title}
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-(--nf-border) opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100">
                        <ChevronRightIcon className="h-3 w-3" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>

      <div className="relative h-42 border-t border-(--nf-border) sm:h-56">
        <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-t from-transparent via-transparent to-white/90 dark:to-black/75" />
        <FlickeringGrid className="absolute inset-0" text="NEXTFLOW" squareSize={2} gridGap={3} color="#14B8A6" />
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 text-center text-[11px] tracking-[0.16em] uppercase text-(--nf-muted)">
          NextFlow • Real-time AI Orchestration
        </div>
      </div>
    </footer>
  );
}

export const Component = FlickeringFooter;
