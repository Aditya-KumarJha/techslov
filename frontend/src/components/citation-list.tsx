import type { Citation } from "@/types/social-rag";
import { formatTimeRange } from "@/lib/format";

type CitationListProps = {
  citations: Citation[];
};

export function CitationList({ citations }: CitationListProps) {
  if (!citations.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {citations.map((citation) => (
        <span
          key={`${citation.videoId}-${citation.chunkId}`}
          className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-slate-200"
        >
          {citation.videoId} · {citation.chunkId} · {formatTimeRange(citation.startTimeSeconds, citation.endTimeSeconds)}
        </span>
      ))}
    </div>
  );
}
