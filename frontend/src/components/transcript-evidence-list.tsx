import { formatTimeRange } from "@/lib/format";
import type { TranscriptEvidence } from "@/types/social-rag";

type TranscriptEvidenceListProps = {
  evidence: TranscriptEvidence[];
};

function groupEvidenceByVideo(evidence: TranscriptEvidence[]) {
  return evidence.reduce<Record<string, TranscriptEvidence[]>>((groups, item) => {
    const groupKey = item.videoId;
    groups[groupKey] = groups[groupKey] ?? [];
    groups[groupKey].push(item);
    return groups;
  }, {});
}

export function TranscriptEvidenceList({ evidence }: TranscriptEvidenceListProps) {
  if (!evidence.length) {
    return null;
  }

  const groups = groupEvidenceByVideo(evidence);

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-slate-200">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Transcript evidence</div>
          <div className="text-[11px] text-slate-500">All transcript chunks returned by the backend</div>
        </div>
        <div className="text-[11px] text-slate-400">{evidence.length}</div>
      </div>

      <div className="grid gap-3">
        {Object.entries(groups).map(([videoId, items]) => (
          <details key={videoId} className="group rounded-xl border border-white/8 bg-white/5 p-2" open={videoId === 'A'}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-1 py-1 text-left">
              <div className="flex items-center gap-2">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${videoId === 'A' ? 'bg-sky-700 text-white' : 'bg-rose-600 text-white'}`}>{videoId}</span>
                <div>
                  <div className="text-sm font-medium text-white">Video {videoId}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{items.length} chunks</div>
                </div>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 group-open:text-slate-300">Toggle</div>
            </summary>

            <div className="mt-2 grid gap-2 max-h-96 overflow-y-auto pr-1">
              {items.map((chunk) => (
                <article key={`${chunk.videoId}-${chunk.chunkId}`} className="rounded-xl border border-white/8 bg-slate-950/40 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300">{chunk.chunkId}</span>
                    <span>{formatTimeRange(chunk.startTimeSeconds, chunk.endTimeSeconds)}</span>
                    {typeof chunk.score === 'number' ? <span>Score {chunk.score.toFixed(3)}</span> : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-100">{chunk.text}</p>
                </article>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}