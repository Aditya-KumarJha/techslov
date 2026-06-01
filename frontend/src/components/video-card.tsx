import type { SocialVideoMetadata } from "@/types/social-rag";
import {
  formatCompactNumber,
  formatDate,
  formatDuration,
  formatPercent,
} from "@/lib/format";
import { HashIcon } from "./ui-icons";

type VideoCardProps = {
  video: SocialVideoMetadata | null;
  videoLabel: "A" | "B";
  loading: boolean;
  compact?: boolean;
};

export function VideoCard({ video, videoLabel, loading, compact = false }: VideoCardProps) {
  const isInstagramVideo = video?.sourceUrl.includes("instagram.com") ?? false;
  const publicViewsLabel =
    video && isInstagramVideo && video.views === 0 ? "Hidden" : video ? formatCompactNumber(video.views) : "--";
  const publicFollowersLabel =
    video && isInstagramVideo && video.followerCount === 0
      ? "Hidden"
      : video
        ? formatCompactNumber(video.followerCount)
        : "--";
  const engagementLabel =
    video && isInstagramVideo && video.views === 0 ? "—" : video ? formatPercent(video.engagementRate) : "--";

  return (
    <section className={`rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.04)] shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl ${compact ? 'p-3' : 'p-4'}`}>
      <div className={`flex items-start justify-between ${compact ? 'gap-3' : 'gap-4'}`}>
        <div className="min-w-0">
          <p className={`font-semibold uppercase tracking-[0.3em] text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>Video {videoLabel}</p>
          <h3 className={`line-clamp-2 font-semibold text-white ${compact ? 'mt-1 text-lg leading-6' : 'mt-2 text-xl'}`}>
            {loading ? "Loading metadata" : video?.title ?? video?.creator ?? "Waiting for ingest"}
          </h3>
          <p className={`${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} truncate text-slate-400`}>
            {video?.creator ?? "Connect a URL to populate this panel"}
          </p>
        </div>

        <div className={`rounded-2xl border border-white/10 bg-white/5 text-right ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
          <p className={`uppercase tracking-[0.2em] text-slate-400 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>Engagement</p>
          <p className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-white`}>{engagementLabel}</p>
        </div>
      </div>

      {video ? (
        <div className={`${compact ? 'mt-3 space-y-3' : 'mt-4 space-y-4'}`}>
          <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
            {[
              ["Views", publicViewsLabel],
              ["Followers", publicFollowersLabel],
            ].map(([label, value]) => (
              <div key={label} className={`rounded-2xl border border-white/10 bg-slate-950/40 ${compact ? 'p-2.5' : 'p-3'}`}>
                <p className={`uppercase tracking-[0.22em] text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>{label}</p>
                <p className={`${compact ? 'mt-1 text-sm' : 'mt-2 text-base'} font-semibold text-white`}>{value}</p>
              </div>
            ))}
          </div>

          <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
            {[
              ["Likes", formatCompactNumber(video.likes)],
              ["Comments", formatCompactNumber(video.comments)],
            ].map(([label, value]) => (
              <div key={label} className={`rounded-2xl border border-white/10 bg-slate-950/40 ${compact ? 'p-2.5' : 'p-3'}`}>
                <p className={`uppercase tracking-[0.22em] text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>{label}</p>
                <p className={`${compact ? 'mt-1 text-sm' : 'mt-2 text-base'} font-semibold text-white`}>{value}</p>
              </div>
            ))}
          </div>

          <div className={`grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 ${compact ? 'p-2.5 text-xs' : 'p-3 text-sm'} text-slate-300 md:grid-cols-2`}>
            <p className="truncate"><span className="text-slate-500">Up:</span> {formatDate(video.uploadDate)}</p>
            <p><span className="text-slate-500">Dur:</span> {formatDuration(video.durationSeconds)}</p>
          </div>

          <div className={`rounded-2xl border border-white/10 bg-slate-950/40 ${compact ? 'p-2.5 text-xs' : 'p-3 text-sm'} text-slate-300`}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              <HashIcon className="h-4 w-4 text-(--accent)" />
              <span>Hashtags</span>
            </div>
            <p className="mt-2 line-clamp-2">
              {video.hashtags.length ? `#${video.hashtags.join(" #")}` : "None"}
            </p>
          </div>

          <div className={`rounded-2xl border border-white/10 bg-slate-950/40 ${compact ? 'p-2.5 text-xs' : 'p-3 text-sm'} text-slate-300`}>
            <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-slate-400">
              <span>Transcript</span>
              <span>{video.transcriptChunkCount ?? 0} chunks</span>
            </div>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-slate-200/90">
              {video.transcriptPreview || "No transcript preview available."}
            </p>
          </div>
        </div>
      ) : (
        <div className={`${compact ? 'mt-3 p-3 text-xs leading-5' : 'mt-4 p-4 text-sm leading-6'} rounded-2xl border border-dashed border-white/10 bg-slate-950/30 text-slate-400`}>
          Ingest videos to load the summary cards.
        </div>
      )}
    </section>
  );
}
