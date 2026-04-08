import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SVGFollower } from "@/components/ui/svg-follower";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/workflow");

  return (
    <main className="nf-landing-bg relative min-h-screen overflow-hidden px-6 py-16 sm:px-10 lg:px-16">
      <SVGFollower
        className="absolute inset-0 z-0 opacity-70"
        colors={["#00d4ff", "#f59e0b", "#34d399", "#38bdf8", "#ffffff"]}
        removeDelay={420}
      />
      <div className="nf-landing-orb nf-landing-orb-a" aria-hidden />
      <div className="nf-landing-orb nf-landing-orb-b" aria-hidden />
      <div className="nf-landing-grid pointer-events-none" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 lg:gap-14">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-(--nf-border) px-4 py-1.5 text-xs font-medium tracking-[0.18em] uppercase text-(--nf-muted) backdrop-blur-md">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
          AI Automation Studio
        </div>

        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <h1 className="nf-hero-title text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Build workflows that feel like magic.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-(--nf-muted) sm:text-lg">
              Design AI-powered automations with an interactive node canvas, trigger real-time runs, and ship
              production-ready flows without stitching ten tools together.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-in"
                className="rounded-xl bg-linear-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(14,165,233,0.32)] transition hover:-translate-y-0.5 hover:opacity-95"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-xl border border-(--nf-border) px-6 py-3 text-sm font-semibold text-(--nf-text) transition hover:-translate-y-0.5 hover:bg-white/60 backdrop-blur-md dark:hover:bg-white/5"
              >
                Create account
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <article className="nf-landing-card">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-cyan-500">Visual Canvas</p>
              <h2 className="mt-2 text-xl font-semibold text-(--nf-text)">Drag. Connect. Run.</h2>
              <p className="mt-2 text-sm leading-relaxed text-(--nf-muted)">
                Map triggers, transforms, and AI blocks in one place with instant feedback.
              </p>
            </article>

            <article className="nf-landing-card">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-amber-500">Realtime Runs</p>
              <h2 className="mt-2 text-xl font-semibold text-(--nf-text)">Watch each step live</h2>
              <p className="mt-2 text-sm leading-relaxed text-(--nf-muted)">
                Observe status, metadata, and outputs while your workflow executes.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
