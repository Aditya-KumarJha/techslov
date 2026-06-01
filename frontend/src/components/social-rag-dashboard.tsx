"use client";

import { useEffect, useState, useRef } from "react";

import {
  addConversationContext,
  deleteConversation,
  fetchConversation,
  fetchVideo,
  ingestVideos,
  listConversations,
  renameConversation,
  setConversationContextIndex,
  streamChatMessage,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import type {
  ChatMessage,
  ChatResponse,
  ConversationSummary,
  ConversationVideoContext,
  IngestJob,
  SocialVideoMetadata,
  VideoId,
} from "@/types/social-rag";
import { ChatPanel } from "./chat-panel";
import { IngestForm } from "./ingest-form";
import { VideoCard } from "./video-card";
import { ChevronLeftIcon, ChevronRightIcon, SparkIcon } from "./ui-icons";

const SAMPLE_YOUTUBE_URL = "";
const SAMPLE_INSTAGRAM_URL = "";
const CONVERSATION_STORAGE_KEY = "social-rag-conversation-id";

function createMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function deriveConversationTitle(message: string) {
  const cleaned = message.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "New chat";
  }

  if (cleaned.length <= 64) {
    return cleaned;
  }

  return `${cleaned.slice(0, 61).trimEnd()}...`;
}

function createConversationContext(
  videoA: SocialVideoMetadata | null,
  videoB: SocialVideoMetadata | null,
): ConversationVideoContext | null {
  if (!videoA || !videoB) {
    return null;
  }

  return {
    contextId: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    videoA,
    videoB,
  };
}

export function SocialRagDashboard() {
  const [videoA, setVideoA] = useState<SocialVideoMetadata | null>(null);
  const [videoB, setVideoB] = useState<SocialVideoMetadata | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("New chat");
  const [conversationList, setConversationList] = useState<ConversationSummary[]>([]);
  const [conversationContexts, setConversationContexts] = useState<ConversationVideoContext[]>([]);
  const [activeContextIndex, setActiveContextIndexState] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [ingestJob, setIngestJob] = useState<IngestJob | null>(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [hideGlobalVideos, setHideGlobalVideos] = useState(false);
  const hideGlobalVideosRef = useRef(hideGlobalVideos);

  useEffect(() => {
    hideGlobalVideosRef.current = hideGlobalVideos;
  }, [hideGlobalVideos]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isSubmittingIngest, setIsSubmittingIngest] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConversationList = async () => {
    try {
      const conversations = await listConversations();
      setConversationList(conversations);
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : "Failed to load conversations");
    }
  };

  const applyConversationContext = (contexts: ConversationVideoContext[], index: number) => {
    const selectedContext = contexts[index] ?? contexts[0] ?? null;

    setConversationContexts(contexts);
    setActiveContextIndexState(index);
    setHideGlobalVideos(false);

    if (selectedContext) {
      setVideoA(selectedContext.videoA);
      setVideoB(selectedContext.videoB);
    }
  };

  const syncConversationHeader = (conversationIdValue: string, title: string) => {
    setConversationTitle(title);
    setConversationList((currentList) =>
      currentList.map((conversation) =>
        conversation.conversationId === conversationIdValue
          ? { ...conversation, title }
          : conversation,
      ),
    );
  };

  const loadConversation = async (targetConversationId: string | null) => {
    if (!targetConversationId) {
      setConversationId(null);
      setConversationTitle("New chat");
      setMessages([]);
      setConversationContexts([]);
      setHideGlobalVideos(true);
      setVideoA(null);
      setVideoB(null);
      setActiveContextIndexState(0);
      window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      return;
    }

    setError(null);
    setIsLoadingConversations(true);

    try {
      const thread = await fetchConversation(targetConversationId);

      if (!thread) {
        setConversationId(null);
        setConversationTitle("New chat");
        setMessages([]);
        setConversationContexts([]);
        setActiveContextIndexState(0);
        window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
        await refreshConversationList();
        return;
      }

      setConversationId(thread.conversationId);
      setConversationTitle(thread.title);
      setMessages(
        thread.turns.map((turn) => ({
          id: String(turn.id),
          role: turn.role,
          content: turn.content,
          citations: turn.citations,
          transcriptEvidence: turn.transcriptEvidence,
        })),
      );
      if (thread.contexts.length) {
        applyConversationContext(thread.contexts, thread.activeContextIndex);
      } else {
        setConversationContexts([]);
        setActiveContextIndexState(0);
        setVideoA(null);
        setVideoB(null);
        setHideGlobalVideos(true);
      }
      window.localStorage.setItem(CONVERSATION_STORAGE_KEY, thread.conversationId);
      await refreshConversationList();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load conversation");
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const shiftConversationContext = async (direction: -1 | 1) => {
    if (!conversationId || conversationContexts.length <= 1) {
      return;
    }

    const nextIndex = (activeContextIndex + direction + conversationContexts.length) % conversationContexts.length;
    applyConversationContext(conversationContexts, nextIndex);

    try {
      await setConversationContextIndex(conversationId, nextIndex);
    } catch (contextError) {
      setError(contextError instanceof Error ? contextError.message : "Failed to switch conversation context");
    }
  };

  const handleRenameConversation = async (conversationIdValue: string) => {
    const currentConversation = conversationList.find(
      (conversation) => conversation.conversationId === conversationIdValue,
    );

    const nextTitle = window.prompt("Rename this chat", currentConversation?.title ?? "");

    if (nextTitle === null) {
      return;
    }

    const trimmedTitle = nextTitle.trim();

    if (!trimmedTitle) {
      return;
    }

    try {
      const updated = await renameConversation(conversationIdValue, trimmedTitle);
      syncConversationHeader(updated.conversationId, updated.title);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Failed to rename conversation");
    }
  };

  const handleDeleteConversation = async (conversationIdValue: string) => {
    const confirmed = window.confirm("Delete this conversation permanently?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteConversation(conversationIdValue);

      if (conversationIdValue === conversationId) {
        await loadConversation(null);
      }

      await refreshConversationList();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete conversation");
    }
  };

  useEffect(() => {
    let active = true;

    const loadVideos = async () => {
      try {
        const [fetchedA, fetchedB] = await Promise.all([fetchVideo("A"), fetchVideo("B")]);

        if (!active) {
          return;
        }

        if (!hideGlobalVideosRef.current) {
          setVideoA(fetchedA);
          setVideoB(fetchedB);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load videos");
        }
      } finally {
        if (active) {
          setIsLoadingVideos(false);
        }
      }
    };

    void loadVideos();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (!conversationId) {
      window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
  }, [conversationId]);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);

    void Promise.all([
      refreshConversationList(),
      stored ? loadConversation(stored) : Promise.resolve(loadConversation(null)),
    ]);
  }, []);

  const startIngest = async (values: { youtubeUrl: string; instagramUrl: string }) => {
    setError(null);
    setIsSubmittingIngest(true);

    try {
      const job = await ingestVideos(values.youtubeUrl, values.instagramUrl);
      const indexedVideos = job.videos.reduce<Record<VideoId, SocialVideoMetadata | null>>(
        (accumulator, video) => {
          accumulator[video.videoId] = video;
          return accumulator;
        },
        { A: null, B: null },
      );

      setIngestJob(job);
      setVideoA(indexedVideos.A);
      setVideoB(indexedVideos.B);
      setHideGlobalVideos(false);
      setInput("");

      if (conversationId) {
        const nextContext = createConversationContext(indexedVideos.A, indexedVideos.B);

        if (nextContext) {
          await addConversationContext(conversationId, nextContext);
          await loadConversation(conversationId);
        }
      } else {
        setMessages([]);
        setConversationId(null);
        setConversationTitle("New chat");
        setConversationContexts([]);
        setActiveContextIndexState(0);
        window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      }

      await refreshConversationList();
    } catch (ingestError) {
      setError(ingestError instanceof Error ? ingestError.message : "Failed to ingest videos");
    } finally {
      setIsSubmittingIngest(false);
    }
  };

  const sendMessage = async (message: string) => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isStreaming) {
      return;
    }

    setError(null);
    setInput("");
    setIsStreaming(true);

    const userMessageId = createMessageId();
    const assistantMessageId = createMessageId();

    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: trimmedMessage,
    };

    const pendingContext = !conversationId ? createConversationContext(videoA, videoB) : null;

    if (!conversationId) {
      setConversationTitle(deriveConversationTitle(trimmedMessage));
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);

    const updateAssistantMessage = (updater: (message: ChatMessage) => ChatMessage) => {
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === assistantMessageId ? updater(message) : message,
        ),
      );
    };

    try {
      const response = await streamChatMessage(
        {
          conversationId: conversationId ?? undefined,
          message: trimmedMessage,
          videoIds: ["A", "B"],
          videoContext: pendingContext ?? undefined,
        },
        {
          onToken: (token) => {
            updateAssistantMessage((assistantMessage) => ({
              ...assistantMessage,
              content: `${assistantMessage.content}${token}`,
            }));
          },
          onFinal: (finalResponse: ChatResponse) => {
            setConversationId(finalResponse.conversationId);
            updateAssistantMessage((assistantMessage) => ({
              ...assistantMessage,
              content: finalResponse.answer,
              citations: finalResponse.citations,
                transcriptEvidence: finalResponse.transcriptEvidence,
            }));
          },
        },
      );

      if (response) {
        setConversationId(response.conversationId);
        window.localStorage.setItem(CONVERSATION_STORAGE_KEY, response.conversationId);
        await refreshConversationList();
      }
    } catch (chatError) {
      updateAssistantMessage((assistantMessage) => ({
        ...assistantMessage,
        content:
          chatError instanceof Error
            ? `I couldn't stream the answer: ${chatError.message}`
            : "I couldn't stream the answer.",
      }));
      setError(chatError instanceof Error ? chatError.message : "Streaming chat failed");
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <main className="h-[125dvh] overflow-hidden text-slate-100">
      <div className="mx-auto grid h-[125dvh] w-full max-w-screen-2xl grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_420px]">
        <aside className="hidden border-r border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-4 lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-[125dvh] lg:overflow-hidden">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white">
                <SparkIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">TechSlov</p>
                <p className="text-xs text-slate-500">Social RAG Studio</p>
              </div>
            </div>
          </div>

          <button
            className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white px-4 py-3 text-left text-sm font-medium text-slate-950 transition hover:-translate-y-px"
            onClick={() => {
              void loadConversation(null);
            }}
            disabled={isStreaming}
            type="button"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-white">+</span>
            New chat
          </button>

          <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-[28px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-3">
            <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">History</p>
                <p className="mt-1 text-xs text-slate-500">Saved conversations</p>
              </div>
              <p className="text-xs text-slate-500">{conversationList.length}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2 pr-1">
              {conversationList.length ? (
                <div className="space-y-2">
                  {conversationList.map((conversation) => {
                    const isActive = conversation.conversationId === conversationId;

                    return (
                      <div
                        key={conversation.conversationId}
                        className={`group flex items-stretch gap-2 rounded-2xl border p-2 text-left transition ${
                          isActive
                            ? "border-white/25 bg-white/10 text-white"
                            : "border-white/10 bg-black/20 text-slate-200 hover:border-white/20 hover:bg-white/5"
                        }`}
                      >
                        <button
                          className="min-w-0 flex-1 rounded-xl px-1 py-1 text-left"
                          disabled={isStreaming}
                          onClick={() => {
                            void loadConversation(conversation.conversationId);
                          }}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm font-medium leading-5 text-white">{conversation.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{conversation.preview}</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                              {conversation.turnCount}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            Updated {formatDate(conversation.updatedAt)}
                          </p>
                        </button>

                        <div className="flex shrink-0 flex-col gap-2 self-stretch">
                          <button
                            className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-300 transition hover:bg-white/10 hover:text-white"
                            disabled={isStreaming}
                            onClick={() => {
                              void handleRenameConversation(conversation.conversationId);
                            }}
                            type="button"
                          >
                            Rename
                          </button>
                          <button
                            className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-500/20"
                            disabled={isStreaming}
                            onClick={() => {
                              void handleDeleteConversation(conversation.conversationId);
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-2 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
                  <span className="text-white">No saved chats yet.</span>
                  <span>Start a conversation and it will appear here automatically.</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="flex h-[125dvh] min-h-0 flex-col overflow-hidden border-x border-white/10 bg-[rgba(255,255,255,0.01)]">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
            <div>
              <IngestForm
                defaultInstagramUrl={SAMPLE_INSTAGRAM_URL}
                defaultYoutubeUrl={SAMPLE_YOUTUBE_URL}
                isLoading={isSubmittingIngest}
                onSubmit={startIngest}
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <ChatPanel
                conversationId={conversationId}
                conversationTitle={conversationTitle}
                input={input}
                isLoadingHistory={isLoadingConversations}
                isStreaming={isStreaming}
                messages={messages}
                onInputChange={setInput}
                onPromptSelect={(prompt) => {
                  setInput(prompt);
                  void sendMessage(prompt);
                }}
                onSubmit={() => {
                  void sendMessage(input);
                }}
              />
            </div>
          </div>
        </section>

        <aside className="hidden h-[125dvh] overflow-y-auto border-l border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-4 xl:block">
          <div className="flex min-h-full flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Conversation context</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {conversationContexts.length ? `Latest first · ${activeContextIndex + 1}/${conversationContexts.length}` : "No saved context yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/30 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!conversationId || conversationContexts.length <= 1}
                    onClick={() => {
                      void shiftConversationContext(-1);
                    }}
                    type="button"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/30 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!conversationId || conversationContexts.length <= 1}
                    onClick={() => {
                      void shiftConversationContext(1);
                    }}
                    type="button"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            <VideoCard loading={isLoadingVideos || isSubmittingIngest} video={videoA} videoLabel="A" compact />
            <VideoCard loading={isLoadingVideos || isSubmittingIngest} video={videoB} videoLabel="B" compact />
          </div>
        </aside>
      </div>
    </main>
  );
}
