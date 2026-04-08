"use client";

import { Bot, Clock3, Play, ShieldCheck, Sparkles, Workflow, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Feature = {
  id: string;
  title: string;
  summary: string;
  details: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
};

const FEATURES: Feature[] = [
  {
    id: "canvas",
    title: "Visual Workflow Canvas",
    summary: "Build flows with drag-and-drop precision.",
    details:
      "Compose automations by connecting nodes for triggers, transforms, LLM calls, and delivery actions with immediate visual feedback.",
    icon: Workflow,
    accentClass: "text-cyan-500",
  },
  {
    id: "ai",
    title: "Smart AI Blocks",
    summary: "Plug AI into every step.",
    details:
      "Drop intelligent nodes into any pipeline to classify, enrich, summarize, and transform data using model-ready prompts.",
    icon: Bot,
    accentClass: "text-fuchsia-500",
  },
  {
    id: "realtime",
    title: "Realtime Run Tracking",
    summary: "Watch runs update live.",
    details:
      "Monitor status, timing, retries, and outputs as workflows execute so teams can react faster to bottlenecks and failures.",
    icon: Zap,
    accentClass: "text-amber-500",
  },
  {
    id: "automation",
    title: "Reliable Scheduling",
    summary: "Run jobs exactly when needed.",
    details:
      "Automate recurring workflows with predictable execution windows, resilient retries, and dependable queue-based processing.",
    icon: Clock3,
    accentClass: "text-emerald-500",
  },
  {
    id: "safety",
    title: "Safe Production Controls",
    summary: "Ship with confidence.",
    details:
      "Use guardrails, route-level protections, and clearly scoped auth boundaries to keep sensitive automations secure in production.",
    icon: ShieldCheck,
    accentClass: "text-blue-500",
  },
  {
    id: "velocity",
    title: "Team Velocity",
    summary: "Collaborate without friction.",
    details:
      "Standardize reusable nodes and automation patterns so teams can iterate quickly without rebuilding common workflow logic.",
    icon: Sparkles,
    accentClass: "text-rose-500",
  },
];

const VIDEO_POSTER =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80";
const VIDEO_SOURCE = "https://cdn.coverr.co/videos/coverr-the-code-on-a-computer-screen-1579/1080p.mp4";

export function LandingInteractiveShowcase() {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [activeFeatureId, setActiveFeatureId] = useState(FEATURES[0].id);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  const activeFeature = useMemo(
    () => FEATURES.find((feature) => feature.id === activeFeatureId) ?? FEATURES[0],
    [activeFeatureId],
  );

  useEffect(() => {
    if (!isVideoOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsVideoOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isVideoOpen]);

  useEffect(() => {
    if (!isVideoOpen || !modalVideoRef.current) return;

    modalVideoRef.current.currentTime = 0;
    void modalVideoRef.current.play();
    modalVideoRef.current.focus();
  }, [isVideoOpen]);

  return (
    <section className="space-y-14">
      <section className="relative rounded-3xl border border-(--nf-border) bg-white/75 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.09)] backdrop-blur-md dark:bg-white/5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-cyan-500">Product Preview</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-(--nf-text) sm:text-3xl">
              See how fast workflows come to life
            </h2>
          </div>
          <p className="max-w-md text-sm text-(--nf-muted)">
            Click the preview to open a focused lightbox and watch a full walkthrough without leaving the page.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsVideoOpen(true)}
          className="group relative mt-5 block w-full overflow-hidden rounded-2xl border border-(--nf-border) text-left"
          aria-label="Open product video"
        >
          <video
            className="h-65 w-full object-cover sm:h-105"
            src={VIDEO_SOURCE}
            poster={VIDEO_POSTER}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/10 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/20 px-5 py-2 text-sm font-semibold text-white backdrop-blur-lg transition group-hover:scale-105">
              <Play className="h-4 w-4" />
              Watch Full Video
            </span>
          </div>
        </button>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
        <div className="relative overflow-hidden rounded-3xl border border-(--nf-border) bg-white/78 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md dark:bg-white/5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(6,182,212,0.16),transparent_35%),radial-gradient(circle_at_88%_86%,rgba(14,165,233,0.12),transparent_35%)]" />

          <div className="relative flex items-center justify-between gap-3 border-b border-(--nf-border) pb-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-cyan-500">Feature Matrix</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-(--nf-text)">Everything in one canvas</h3>
            </div>
            <span className="rounded-full border border-cyan-300/50 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase text-cyan-700 dark:text-cyan-300">
              Live Ready
            </span>
          </div>

          <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              const isActive = feature.id === activeFeatureId;

              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setActiveFeatureId(feature.id)}
                  className={`group rounded-2xl border p-4 text-left transition ${
                    isActive
                      ? "border-cyan-300 bg-cyan-500/10 shadow-[0_10px_24px_rgba(8,145,178,0.2)]"
                      : "border-(--nf-border) bg-white/70 hover:border-cyan-200 hover:bg-white/90 dark:bg-white/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--nf-border) bg-white/90 dark:bg-white/10">
                      <Icon className={`h-4 w-4 ${feature.accentClass}`} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-(--nf-text)">{feature.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-(--nf-muted)">{feature.summary}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <article className="relative overflow-hidden rounded-3xl border border-(--nf-border) bg-white/82 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md dark:bg-white/5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-cyan-500/12 to-transparent" />
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-cyan-500">Selected Capability</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-(--nf-text)">{activeFeature.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-(--nf-muted)">{activeFeature.summary}</p>
          <p className="mt-4 text-sm leading-relaxed text-(--nf-muted)">{activeFeature.details}</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-(--nf-border) bg-white/70 p-3 text-center dark:bg-white/5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-(--nf-muted)">Latency</p>
              <p className="mt-1 text-lg font-semibold text-(--nf-text)">&lt;200ms</p>
            </div>
            <div className="rounded-xl border border-(--nf-border) bg-white/70 p-3 text-center dark:bg-white/5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-(--nf-muted)">Uptime</p>
              <p className="mt-1 text-lg font-semibold text-(--nf-text)">99.9%</p>
            </div>
            <div className="rounded-xl border border-(--nf-border) bg-white/70 p-3 text-center dark:bg-white/5">
              <p className="text-[11px] uppercase tracking-[0.12em] text-(--nf-muted)">Scale</p>
              <p className="mt-1 text-lg font-semibold text-(--nf-text)">10k+</p>
            </div>
          </div>
        </article>
      </section>

      {isVideoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Product walkthrough video"
          onClick={() => setIsVideoOpen(false)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsVideoOpen(false)}
              className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black"
              aria-label="Close video"
            >
              <X className="h-5 w-5" />
            </button>
            <video
              ref={modalVideoRef}
              className="h-70 w-full object-cover sm:h-135"
              src={VIDEO_SOURCE}
              poster={VIDEO_POSTER}
              controls
              playsInline
              preload="auto"
              tabIndex={-1}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
