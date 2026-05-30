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
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Citations</div>
        <div className="text-[11px] text-slate-400">{citations.length}</div>
      </div>

      <div className="grid gap-2">
        {citations.map((citation) => (
          <button
            key={`${citation.videoId}-${citation.chunkId}`}
            onClick={() => {
              // click currently logs; can be wired to seek player or scroll to chunk
              // eslint-disable-next-line no-console
              console.log('citation-click', citation);
            }}
            type="button"
            className="group flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-black/10 px-3 py-2 hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-7 w-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${
                  citation.videoId === 'A' ? 'bg-sky-700 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {citation.videoId}
              </div>

              <div className="min-w-0 text-left">
                <div className="truncate text-sm font-medium text-white">{citation.chunkId}</div>
                <div className="text-xs text-slate-400">{formatTimeRange(citation.startTimeSeconds, citation.endTimeSeconds)}</div>
              </div>
            </div>

            <div className="text-xs text-slate-400 group-hover:text-white">View</div>
          </button>
        ))}
      </div>
    </div>
  );
}
