import { SVGFollower } from "@/components/ui/svg-follower";

export default function DemoOne() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="h-[70vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-(--nf-border) bg-(--nf-panel)">
        <SVGFollower colors={["#ff6b6b", "#fff200", "#45b7d1", "#96ceb4", "#ffeaa7"]} />
      </div>
    </div>
  );
}
