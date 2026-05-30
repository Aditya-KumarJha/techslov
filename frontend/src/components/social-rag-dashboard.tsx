"use client";

import { useEffect, useState } from "react";

import { fetchVideo, ingestVideos, streamChatMessage } from "@/lib/api";
import type {
  ChatMessage,
  ChatResponse,
  IngestJob,
  SocialVideoMetadata,
  VideoId,
} from "@/types/social-rag";
import { ChatPanel } from "./chat-panel";
import { IngestForm } from "./ingest-form";
import { VideoCard } from "./video-card";
import { SparkIcon } from "./ui-icons";

const SAMPLE_YOUTUBE_URL = "";
const SAMPLE_INSTAGRAM_URL = "";
const CONVERSATION_STORAGE_KEY = "social-rag-conversation-id";

function createMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function SocialRagDashboard() {
  const [videoA, setVideoA] = useState<SocialVideoMetadata | null>(null);
  const [videoB, setVideoB] = useState<SocialVideoMetadata | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [ingestJob, setIngestJob] = useState<IngestJob | null>(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isSubmittingIngest, setIsSubmittingIngest] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadVideos = async () => {
      try {
        const [fetchedA, fetchedB] = await Promise.all([fetchVideo("A"), fetchVideo("B")]);

        if (!active) {
          return;
        }

        setVideoA(fetchedA);
        setVideoB(fetchedB);
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
    if (!mounted) return;

    if (!conversationId) {
      window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
  }, [conversationId]);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (stored) setConversationId(stored);
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
      setMessages([]);
      setConversationId(null);
      setInput("");
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
            }));
          },
        },
      );

      if (response) {
        setConversationId(response.conversationId);
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
    <main className="min-h-screen text-slate-100">
      <div className="mx-auto grid min-h-screen w-full max-w-screen-2xl grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_420px]">
        <aside className="hidden border-r border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-4 lg:flex lg:flex-col lg:sticky lg:top-6 lg:self-start lg:overflow-hidden">
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

          <button className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white px-4 py-3 text-left text-sm font-medium text-slate-950 transition hover:-translate-y-px">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-white">+</span>
            New chat
          </button>
        </aside>

        <section className="flex min-h-screen flex-col border-x border-white/10 bg-[rgba(255,255,255,0.01)]">
          <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
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

            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <ChatPanel
                conversationId={conversationId}
                input={input}
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

        <aside className="hidden border-l border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-4 xl:block">
          <div className="space-y-4">
            <VideoCard loading={isLoadingVideos || isSubmittingIngest} video={videoA} videoLabel="A" />
            <VideoCard loading={isLoadingVideos || isSubmittingIngest} video={videoB} videoLabel="B" />
          </div>
        </aside>
      </div>
    </main>
  );
}
