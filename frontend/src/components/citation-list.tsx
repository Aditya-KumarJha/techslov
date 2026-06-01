import { useState } from "react";
import type { Citation } from "@/types/social-rag";
import { formatTimeRange } from "@/lib/format";

type CitationListProps = {
  citations: Citation[];
};

export function CitationList({ citations }: CitationListProps) {
  const [openCitationKey, setOpenCitationKey] = useState<string | null>(null);

  if (!citations.length) {
    return null;
  }

  const toggleCitation = (citation: Citation) => {
    const key = `${citation.videoId}-${citation.chunkId}-${citation.startTimeSeconds}-${citation.endTimeSeconds}`;
    setOpenCitationKey((currentKey) => (currentKey === key ? null : key));
  };

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Answer citations</div>
        <div className="text-[11px] text-slate-400">{citations.length}</div>
      </div>

      <div className="grid gap-2">
        {citations.map((citation) => (
          (() => {
            const citationKey = `${citation.videoId}-${citation.chunkId}-${citation.startTimeSeconds}-${citation.endTimeSeconds}`;
            const isOpen = openCitationKey === citationKey;

            return (
          <button
            key={citationKey}
            onClick={() => toggleCitation(citation)}
            type="button"
            className="group flex w-full flex-col gap-3 rounded-lg border border-white/6 bg-black/10 px-3 py-2 text-left hover:bg-white/5"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
              <div
                className={`h-7 w-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${
                  citation.videoId === 'A' ? 'bg-sky-700 text-white' : 'bg-rose-600 text-white'
                }`}
              >
                {citation.videoId}
              </div>

              <div className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{citation.chunkId}</span>
                  {typeof citation.score === 'number' ? <span>Score {citation.score.toFixed(3)}</span> : null}
                </div>
                <div className="text-xs text-slate-400">{formatTimeRange(citation.startTimeSeconds, citation.endTimeSeconds)}</div>
                <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-200">{citation.text}</p>
              </div>
            </div>

              <div className="shrink-0 text-xs text-slate-400 group-hover:text-white">{isOpen ? 'Hide' : 'View'}</div>
            </div>

            {isOpen ? (
              <div className="rounded-xl border border-white/8 bg-slate-950/40 p-3 text-xs leading-5 text-slate-300">
                <div className="grid gap-1">
                  <div><span className="text-slate-500">Source:</span> {citation.sourceUrl || 'Unavailable'}</div>
                  <div><span className="text-slate-500">Range:</span> {formatTimeRange(citation.startTimeSeconds, citation.endTimeSeconds)}</div>
                  {citation.metadata && Object.keys(citation.metadata).length ? (
                    <div className="text-slate-400">
                      <span className="text-slate-500">Meta:</span> {JSON.stringify(citation.metadata)}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </button>
            );
          })()
        ))}
      </div>
    </div>
  );
}
