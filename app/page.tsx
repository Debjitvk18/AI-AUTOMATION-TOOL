import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/workflow");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">NextFlow</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Visual LLM workflows with Gemini, React Flow, Trigger.dev, and a Krea-inspired editor.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/sign-in"
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
