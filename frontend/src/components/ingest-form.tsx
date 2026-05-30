"use client";

import { LinkIcon } from "./ui-icons";

type IngestFormProps = {
  defaultYoutubeUrl: string;
  defaultInstagramUrl: string;
  isLoading: boolean;
  onSubmit: (values: { youtubeUrl: string; instagramUrl: string }) => void;
};

export function IngestForm({
  defaultYoutubeUrl,
  defaultInstagramUrl,
  isLoading,
  onSubmit,
}: IngestFormProps) {
  return (
    <form
      className="rounded-[28px] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        onSubmit({
          youtubeUrl: String(formData.get("youtubeUrl") ?? "").trim(),
          instagramUrl: String(formData.get("instagramUrl") ?? "").trim(),
        });
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-white" />
          <div>
            <h2 className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">Ingest</h2>
            <p className="mt-1 text-xs text-slate-500">Two source URLs</p>
          </div>
        </div>
        <p className="text-xs text-slate-400">Ready</p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <label className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">YouTube</span>
          <input
            className="h-12 rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-(--accent) focus:ring-2 focus:ring-white/10"
            defaultValue={defaultYoutubeUrl}
            name="youtubeUrl"
            placeholder="https://www.youtube.com/watch?v=..."
            type="url"
            required
          />
        </label>

        <label className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Instagram</span>
          <input
            className="h-12 rounded-2xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-(--accent) focus:ring-2 focus:ring-white/10"
            defaultValue={defaultInstagramUrl}
            name="instagramUrl"
            placeholder="https://www.instagram.com/reel/..."
            type="url"
            required
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs leading-5 text-slate-400">One YouTube and one Reel. No extra noise.</div>
        <button
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 transition hover:-translate-y-px hover:shadow-[0_12px_30px_rgba(255,255,255,0.18)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "Ingesting…" : "Run ingestion"}
        </button>
      </div>
    </form>
  );
}
