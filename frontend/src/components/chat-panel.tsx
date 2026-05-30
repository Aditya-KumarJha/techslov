"use client";

import type { ChatMessage } from "@/types/social-rag";
import { CitationList } from "./citation-list";
import { ChatBubbleIcon, SendIcon, SparkIcon } from "./ui-icons";

type ChatPanelProps = {
  conversationId: string | null;
  input: string;
  isStreaming: boolean;
  messages: ChatMessage[];
  onInputChange: (value: string) => void;
  onPromptSelect: (prompt: string) => void;
  onSubmit: () => void;
};

const QUICK_PROMPTS = [
  "Why A > B?",
  "Engagement rate?",
  "Hook comparison",
  "Creator B?",
  "Improve B",
];

export function ChatPanel({
  conversationId,
  input,
  isStreaming,
  messages,
  onInputChange,
  onPromptSelect,
  onSubmit,
}: ChatPanelProps) {
  // Filter out empty assistant placeholders so they don't render
  const visibleMessages = messages.filter(
    (m) => !(m.role === "assistant" && (!m.content || !m.content.trim())),
  );

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[28px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-5">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white">
            <ChatBubbleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">Chat</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Where should we begin?</h2>
            <p className="mt-1 text-sm text-slate-400">Ask about the two videos, then keep the thread moving.</p>
          </div>
        </div>

        <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right sm:block">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Thread</p>
          <p className="mt-1 text-sm font-medium text-white">{conversationId ?? "new"}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
            disabled={isStreaming}
            onClick={() => onPromptSelect(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-3xl border border-white/10 bg-black/20 p-4">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {visibleMessages.length ? (
            visibleMessages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div key={`${message.role}-${index}`} className="flex w-full items-start gap-3 justify-center">
                  {!isUser ? (
                    <div className="shrink-0">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-white">AI</div>
                    </div>
                  ) : null}

                  <article
                    className={`w-fit max-w-2xl rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm wrap-break-word ${
                      isUser ? "border-white/10 bg-white/10 text-white" : "border-white/10 bg-white/5 text-slate-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.citations?.length ? <CitationList citations={message.citations} /> : null}
                  </article>

                  {isUser ? (
                    <div className="shrink-0">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-white">ME</div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="grid gap-2 rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm leading-6 text-slate-400">
              <span className="text-white">No messages yet.</span>
              <span>Ingest two URLs, then ask a comparison question.</span>
            </div>
          )}

          {isStreaming ? (
            <div className="flex w-full items-start gap-3 justify-center">
              <div className="shrink-0">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-white">AI</div>
              </div>
              <article className="w-fit max-w-2xl rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">Streaming answer…</article>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-3">
            <input
              className="h-10 w-full bg-transparent px-2 text-sm text-white outline-none placeholder:text-slate-500"
              disabled={isStreaming}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isStreaming) {
                    onSubmit();
                  }
                }
              }}
              placeholder="Ask about the two videos..."
              value={input}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs leading-5 text-slate-500">
              <SparkIcon className="h-4 w-4 text-white" />
              <span>Conversation memory stays attached to the thread.</span>
            </div>

            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isStreaming || !input.trim()}
              onClick={onSubmit}
              type="button"
            >
              <SendIcon className="h-4 w-4" />
              {isStreaming ? "Thinking…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
