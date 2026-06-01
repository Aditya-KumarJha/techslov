"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/social-rag";
import { CitationList } from "./citation-list";
import { TranscriptEvidenceList } from "./transcript-evidence-list";
import { ChatBubbleIcon, SendIcon, SparkIcon } from "./ui-icons";

type ChatPanelProps = {
  conversationId: string | null;
  conversationTitle: string;
  input: string;
  isAuthenticated: boolean;
  isStreaming: boolean;
  isLoadingHistory: boolean;
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
  conversationTitle,
  input,
  isAuthenticated,
  isStreaming,
  isLoadingHistory,
  messages,
  onInputChange,
  onPromptSelect,
  onSubmit,
}: ChatPanelProps) {
  // Filter out empty assistant placeholders so they don't render
  const visibleMessages = messages.filter(
    (m) => !(m.role === "assistant" && (!m.content || !m.content.trim())),
  );
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    // scroll to bottom when messages change or streaming state changes
    // use requestAnimationFrame to wait for DOM updates
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [visibleMessages.length, isStreaming]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-5">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white">
            <ChatBubbleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">Chat</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              {conversationTitle || "New chat"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {conversationId
                ? "Loaded thread saved to your private history."
                : isAuthenticated
                  ? "Ask about the two videos, then keep the thread moving."
                  : "Guest chat is active."}
            </p>
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

      <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-4">
        <div ref={messagesContainerRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
            {isLoadingHistory ? (
            <div className="grid gap-2 rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm leading-6 text-slate-400">
              <span className="text-white">Loading conversation…</span>
              <span>Fetching the saved messages for this thread.</span>
            </div>
          ) : visibleMessages.length ? (
            visibleMessages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div key={`${message.role}-${index}`} className={`flex w-full items-end gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser ? (
                    <div className="shrink-0 self-end">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-white">AI</div>
                    </div>
                  ) : null}

                  <div className={`w-fit max-w-2xl ${isUser ? 'justify-end' : ''}`}>
                    <article
                      className={`rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm wrap-break-word ${
                        isUser
                          ? "border-white/10 bg-white/12 text-white"
                          : "border-white/10 bg-white/5 text-slate-100"
                      }`}
                    >
                      {message.citations?.length ? <CitationList citations={message.citations} /> : null}
                      {message.transcriptEvidence?.length ? <TranscriptEvidenceList evidence={message.transcriptEvidence} /> : null}
                      {renderMessageContent(message.content)}
                    </article>
                  </div>

                  {isUser ? (
                    <div className="shrink-0 self-end">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-semibold text-slate-950">ME</div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="grid gap-2 rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm leading-6 text-slate-400">
              <span className="text-white">No messages yet.</span>
              <span>Ingest two URLs, then ask a comparison question or load a saved thread.</span>
            </div>
          )}

          {isStreaming ? (
            <div className={`flex w-full items-end gap-3 justify-start`}>
              <div className="shrink-0 self-end">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-white">AI</div>
              </div>

              <article className={`w-fit max-w-2xl rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm wrap-break-word border-dashed border-white/10 bg-white/5 text-slate-300`}>
                <p className="whitespace-pre-wrap">Streaming answer…</p>
              </article>
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
              <span>
                {isAuthenticated
                  ? "Conversation memory stays attached to your signed-in thread."
                  : "Conversation memory stays only in this tab while you remain in guest mode."}
              </span>
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

function renderMessageContent(content: string) {
  if (!content) return null;

  // Simple bold parsing for **bold**
  const parts: Array<string | { bold: string }> = [];
  let rest = content;

  while (rest.length) {
    const start = rest.indexOf("**");
    if (start === -1) {
      parts.push(rest);
      break;
    }

    if (start > 0) {
      parts.push(rest.slice(0, start));
      rest = rest.slice(start);
    }

    // remove starting **
    rest = rest.slice(2);
    const end = rest.indexOf("**");
    if (end === -1) {
      // no closing, push remainder
      parts.push(`**${rest}`);
      break;
    }

    const boldText = rest.slice(0, end);
    parts.push({ bold: boldText });
    rest = rest.slice(end + 2);
  }

  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, idx) =>
        typeof part === 'string' ? (
          <span key={idx}>{part}</span>
        ) : (
          <strong key={idx} className="font-semibold text-white">
            {part.bold}
          </strong>
        ),
      )}
    </p>
  );
}
