import type { SocialVideoMetadata } from "@/types/social-rag";
import { formatPercent } from "@/lib/format";
import { VideoCard } from "./video-card";
import { ChartIcon } from "./ui-icons";

type VideoComparisonProps = {
  videoA: SocialVideoMetadata | null;
  videoB: SocialVideoMetadata | null;
  isLoading: boolean;
};

export function VideoComparison({ videoA, videoB, isLoading }: VideoComparisonProps) {
  const delta =
    videoA && videoB
      ? Math.abs(videoA.engagementRate - videoB.engagementRate)
      : null;
  const summary =
    videoA && videoB
      ? videoA.engagementRate === videoB.engagementRate
        ? "tied"
        : videoA.engagementRate > videoB.engagementRate
          ? "A leads"
          : "B leads"
      : "waiting";

  return (
    <section className="grid gap-5 rounded-[28px] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white">
            <ChartIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Videos</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">A vs B</h2>
          </div>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
          {delta !== null ? (
            <>
              Delta: <span className="font-semibold text-white">{formatPercent(delta)}</span>
            </>
          ) : (
            summary
          )}
        </div>
      </div>

      <div className="grid gap-4">
        <VideoCard loading={isLoading} video={videoA} videoLabel="A" />
        <VideoCard loading={isLoading} video={videoB} videoLabel="B" />
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-4 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">A</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{videoA ? videoA.creator : "Waiting"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Rates</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {videoA && videoB ? `${formatPercent(videoA.engagementRate)} / ${formatPercent(videoB.engagementRate)}` : "--"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">B</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{videoB ? videoB.creator : "Waiting"}</p>
        </div>
      </div>
    </section>
  );
}
