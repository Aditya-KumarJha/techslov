"use client";

import { useAuth, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useEffectEvent, useRef, useState } from "react";

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
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, SearchIcon, SparkIcon } from "./ui-icons";

const SAMPLE_YOUTUBE_URL = "";
const SAMPLE_INSTAGRAM_URL = "";

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
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [globalVideoA, setGlobalVideoA] = useState<SocialVideoMetadata | null>(null);
  const [globalVideoB, setGlobalVideoB] = useState<SocialVideoMetadata | null>(null);
  const [videoA, setVideoA] = useState<SocialVideoMetadata | null>(null);
  const [videoB, setVideoB] = useState<SocialVideoMetadata | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("New chat");
  const [conversationList, setConversationList] = useState<ConversationSummary[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [conversationContexts, setConversationContexts] = useState<ConversationVideoContext[]>([]);
  const [activeContextIndex, setActiveContextIndexState] = useState(0);
  const [input, setInput] = useState("");
  const [ingestJob, setIngestJob] = useState<IngestJob | null>(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isSubmittingIngest, setIsSubmittingIngest] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConversationContext, setShowConversationContext] = useState(false);
  const authSyncRef = useRef<string | null>(null);

  const formatUserError = (value: unknown, fallback: string) => {
    const message = value instanceof Error ? value.message : typeof value === "string" ? value : "";
    const normalized = message.toLowerCase();

    if (
      normalized.includes("clerk") ||
      normalized.includes("publishable key") ||
      normalized.includes("secret key") ||
      normalized.includes("token") ||
      normalized.includes("authorization")
    ) {
      return "Authentication is temporarily unavailable. Please try again.";
    }

    if (!message) {
      return fallback;
    }

    return fallback;
  };

  const conversationStorageKey = user ? `social-rag-conversation-id:${user.id}` : null;
  const filteredConversationList = conversationList.filter((conversation) => {
    const query = historySearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      conversation.title.toLowerCase().includes(query)
      || conversation.preview.toLowerCase().includes(query)
    );
  });

  const resolveAuthOptions = async () => {
    if (!isSignedIn) {
      return undefined;
    }

    const token = await getToken();
    return token ? { token } : undefined;
  };

  const applyGlobalVideos = () => {
    setShowConversationContext(false);
    setVideoA(globalVideoA);
    setVideoB(globalVideoB);
  };

  const clearConversationState = () => {
    setConversationId(null);
    setConversationTitle("New chat");
    setMessages([]);
    setConversationContexts([]);
    setActiveContextIndexState(0);
    applyGlobalVideos();
  };

  const refreshConversationList = async (authOptions?: { token?: string | null }) => {
    if (!isSignedIn) {
      setConversationList([]);
      return;
    }

    try {
      const conversations = await listConversations(authOptions ?? (await resolveAuthOptions()));
      setConversationList(conversations);
    } catch (listError) {
      setError(formatUserError(listError, "We couldn't load your conversations right now."));
    }
  };

  const applyConversationContext = (contexts: ConversationVideoContext[], index: number) => {
    const selectedContext = contexts[index] ?? contexts[0] ?? null;

    setConversationContexts(contexts);
    setActiveContextIndexState(index);
    setShowConversationContext(Boolean(selectedContext));

    if (selectedContext) {
      setVideoA(selectedContext.videoA);
      setVideoB(selectedContext.videoB);
      return;
    }

    applyGlobalVideos();
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

  const loadConversation = async (
    targetConversationId: string | null,
    authOptions?: { token?: string | null },
  ) => {
    if (!targetConversationId || !isSignedIn) {
      clearConversationState();
      if (conversationStorageKey) {
        window.localStorage.removeItem(conversationStorageKey);
      }
      return;
    }

    setError(null);
    setIsLoadingConversations(true);

    try {
      const thread = await fetchConversation(targetConversationId, authOptions ?? (await resolveAuthOptions()));

      if (!thread) {
        clearConversationState();
        if (conversationStorageKey) {
          window.localStorage.removeItem(conversationStorageKey);
        }
        await refreshConversationList(authOptions);
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
        applyGlobalVideos();
      }

      if (conversationStorageKey) {
        window.localStorage.setItem(conversationStorageKey, thread.conversationId);
      }
      await refreshConversationList(authOptions);
    } catch (loadError) {
      setError(formatUserError(loadError, "We couldn't open that conversation right now."));
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const shiftConversationContext = async (direction: -1 | 1) => {
    if (!conversationId || conversationContexts.length <= 1 || !isSignedIn) {
      return;
    }

    const nextIndex =
      (activeContextIndex + direction + conversationContexts.length) % conversationContexts.length;
    applyConversationContext(conversationContexts, nextIndex);

    try {
      await setConversationContextIndex(
        conversationId,
        nextIndex,
        await resolveAuthOptions(),
      );
    } catch (contextError) {
      setError(formatUserError(contextError, "We couldn't switch the saved context right now."));
    }
  };

  const handleRenameConversation = async (conversationIdValue: string) => {
    if (!isSignedIn) {
      return;
    }

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
      const updated = await renameConversation(
        conversationIdValue,
        trimmedTitle,
        await resolveAuthOptions(),
      );
      syncConversationHeader(updated.conversationId, updated.title);
    } catch (renameError) {
      setError(formatUserError(renameError, "We couldn't rename that conversation right now."));
    }
  };

  const handleDeleteConversation = async (conversationIdValue: string) => {
    if (!isSignedIn) {
      return;
    }

    const confirmed = window.confirm("Delete this conversation permanently?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteConversation(conversationIdValue, await resolveAuthOptions());

      if (conversationIdValue === conversationId) {
        await loadConversation(null);
      }

      await refreshConversationList();
    } catch (deleteError) {
      setError(formatUserError(deleteError, "We couldn't delete that conversation right now."));
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

        setGlobalVideoA(fetchedA);
        setGlobalVideoB(fetchedB);
        setVideoA(fetchedA);
        setVideoB(fetchedB);
      } catch (loadError) {
        if (active) {
          setError(formatUserError(loadError, "We couldn't load the videos right now."));
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

  const syncAuthState = useEffectEvent(async () => {
    setError(null);

    if (!isSignedIn) {
      setConversationList([]);
      clearConversationState();
      return;
    }

    const authOptions = await resolveAuthOptions();
    await refreshConversationList(authOptions);

    const storedConversationId = conversationStorageKey
      ? window.localStorage.getItem(conversationStorageKey)
      : null;

    if (storedConversationId) {
      await loadConversation(storedConversationId, authOptions);
    } else {
      clearConversationState();
    }
  });

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    const authKey = `${user?.id ?? "guest"}:${isSignedIn ? "signed-in" : "signed-out"}`;
    if (authSyncRef.current === authKey) {
      return;
    }
    authSyncRef.current = authKey;

    void syncAuthState();
  }, [isAuthLoaded, isSignedIn, user?.id]);

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
      setGlobalVideoA(indexedVideos.A);
      setGlobalVideoB(indexedVideos.B);
      setInput("");

      if (showConversationContext) {
        setConversationContexts([]);
        setActiveContextIndexState(0);
        setShowConversationContext(false);
      }

      setVideoA(indexedVideos.A);
      setVideoB(indexedVideos.B);

      if (conversationId && isSignedIn) {
        const nextContext = createConversationContext(indexedVideos.A, indexedVideos.B);

        if (nextContext) {
          await addConversationContext(
            conversationId,
            nextContext,
            await resolveAuthOptions(),
          );
          await loadConversation(conversationId);
        }
      } else if (!conversationId) {
        clearConversationState();
      }

      await refreshConversationList();
    } catch (ingestError) {
      setError(formatUserError(ingestError, "We couldn't ingest those videos right now."));
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
    const history = messages
      .filter((messageItem) => messageItem.content.trim())
      .map((messageItem) => ({
        role: messageItem.role,
        content: messageItem.content,
      }));

    if (!conversationId) {
      setConversationTitle(deriveConversationTitle(trimmedMessage));
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);

    const updateAssistantMessage = (updater: (messageItem: ChatMessage) => ChatMessage) => {
      setMessages((currentMessages) =>
        currentMessages.map((messageItem) =>
          messageItem.id === assistantMessageId ? updater(messageItem) : messageItem,
        ),
      );
    };

    try {
      const authOptions = await resolveAuthOptions();
      const response = await streamChatMessage(
        {
          conversationId: isSignedIn ? conversationId ?? undefined : undefined,
          message: trimmedMessage,
          videoIds: ["A", "B"],
          videoContext: pendingContext ?? undefined,
          history,
        },
        {
          onToken: (token) => {
            updateAssistantMessage((assistantMessage) => ({
              ...assistantMessage,
              content: `${assistantMessage.content}${token}`,
            }));
          },
          onFinal: (finalResponse: ChatResponse) => {
            if (isSignedIn) {
              setConversationId(finalResponse.conversationId);
            }
            updateAssistantMessage((assistantMessage) => ({
              ...assistantMessage,
              content: finalResponse.answer,
              citations: finalResponse.citations,
              transcriptEvidence: finalResponse.transcriptEvidence,
            }));
          },
        },
        authOptions,
      );

      if (response && isSignedIn) {
        setConversationId(response.conversationId);
        if (conversationStorageKey) {
          window.localStorage.setItem(conversationStorageKey, response.conversationId);
        }
        await refreshConversationList(authOptions);
      }
    } catch (chatError) {
      updateAssistantMessage((assistantMessage) => ({
        ...assistantMessage,
        content: "I couldn't complete that response right now. Please try again.",
      }));
      setError(formatUserError(chatError, "We couldn't send that message right now."));
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
                <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400">
                  History
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {isSignedIn ? "Private conversations" : "Sign in to save chats"}
                </p>
              </div>
              <p className="text-xs text-slate-500">{isSignedIn ? filteredConversationList.length : "guest"}</p>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <SearchIcon className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  className="h-8 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Search chats"
                  type="text"
                  value={historySearch}
                />
                {historySearch ? (
                  <button
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                    onClick={() => setHistorySearch("")}
                    type="button"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2 pr-1">
              {!isSignedIn ? (
                <div className="grid gap-2 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
                  <span className="text-white">Guest mode is active.</span>
                </div>
              ) : filteredConversationList.length ? (
                <div className="space-y-2">
                  {filteredConversationList.map((conversation) => {
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
                              <p className="line-clamp-2 text-sm font-medium leading-5 text-white">
                                {conversation.title}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                                {conversation.preview}
                              </p>
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
              ) : conversationList.length ? (
                <div className="grid gap-2 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
                  <span className="text-white">No matching chats found.</span>
                  <span>Try a different chat name or clear the search box.</span>
                </div>
              ) : (
                <div className="grid gap-2 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
                  <span className="text-white">No saved chats yet.</span>
                  <span>Start a conversation while signed in and it will appear here automatically.</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="flex h-[125dvh] min-h-0 flex-col overflow-hidden border-x border-white/10 bg-[rgba(255,255,255,0.01)]">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-[28px] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Authentication</p>
                <h1 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  {isSignedIn
                    ? `Welcome back${user?.firstName ? `, ${user.firstName}` : ""}`
                    : "Sign in to save private chats"}
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {isSignedIn
                    ? "Your chat history and video contexts are stored only under your Clerk account."
                    : "You can still use every feature as a guest, but guest chats are temporary and disappear on refresh."}
                </p>
              </div>

              <div className="flex items-center gap-3 self-center">
                {isSignedIn ? (
                  <div className="rounded-full border border-white/10 bg-white/5 p-1">
                    <UserButton afterSignOutUrl="/" />
                  </div>
                ) : (
                  <>
                    <SignInButton mode="modal">
                      <button
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                        type="button"
                      >
                        Sign in
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:-translate-y-px"
                        type="button"
                      >
                        Sign up
                      </button>
                    </SignUpButton>
                  </>
                )}
              </div>
            </div>

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

            {ingestJob ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Ingest completed with {ingestJob.chunkCount} transcript chunks.
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              <ChatPanel
                conversationId={isSignedIn ? conversationId : null}
                conversationTitle={conversationTitle}
                input={input}
                isAuthenticated={Boolean(isSignedIn)}
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
                  {conversationContexts.length
                    ? `Latest first · ${activeContextIndex + 1}/${conversationContexts.length}`
                    : "No saved context yet"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/30 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!conversationId || conversationContexts.length <= 1 || !isSignedIn}
                  onClick={() => {
                    void shiftConversationContext(-1);
                  }}
                  type="button"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/30 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!conversationId || conversationContexts.length <= 1 || !isSignedIn}
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
