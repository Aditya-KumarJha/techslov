import type {
  ChatRequest,
  ChatResponse,
  ConversationContextIndexUpdate,
  ConversationSummary,
  ConversationThread,
  ConversationTitleUpdate,
  ConversationVideoContext,
  IngestJob,
  SocialVideoMetadata,
  VideoId,
} from "@/types/social-rag";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5050/api/v1";

type StreamHandlers = {
  onToken: (token: string) => void;
  onFinal: (response: ChatResponse) => void;
};

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as { data?: T; message?: string };

  if (!response.ok) {
    throw new ApiError(
      payload.message ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }

  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  return parseJsonResponse<T>(response);
}

export async function ingestVideos(youtubeUrl: string, instagramUrl: string) {
  return requestJson<IngestJob>("/ingest", {
    method: "POST",
    body: JSON.stringify({ youtubeUrl, instagramUrl }),
  });
}

export async function fetchVideo(videoId: VideoId) {
  try {
    return await requestJson<SocialVideoMetadata>(`/videos/${videoId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function listConversations() {
  return requestJson<ConversationSummary[]>("/history/conversations");
}

export async function fetchConversation(conversationId: string) {
  try {
    return await requestJson<ConversationThread>(`/history/conversations/${conversationId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function renameConversation(conversationId: string, title: string) {
  return requestJson<{ conversationId: string; title: string }>(`/history/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ title } satisfies ConversationTitleUpdate),
  });
}

export async function deleteConversation(conversationId: string) {
  const response = await fetch(`${API_BASE_URL}/history/conversations/${conversationId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorPayload = await response.text();
    throw new Error(errorPayload || `Request failed with status ${response.status}`);
  }
}

export async function addConversationContext(conversationId: string, context: ConversationVideoContext) {
  return requestJson<ConversationVideoContext>(`/history/conversations/${conversationId}/contexts`, {
    method: "POST",
    body: JSON.stringify(context),
  });
}

export async function setConversationContextIndex(conversationId: string, activeContextIndex: number) {
  return requestJson<{ conversationId: string; activeContextIndex: number }>(
    `/history/conversations/${conversationId}/context-index`,
    {
      method: "PATCH",
      body: JSON.stringify({ activeContextIndex } satisfies ConversationContextIndexUpdate),
    },
  );
}

function readSseEventStream(text: string) {
  return text
    .split(/\n\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const lines = entry.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLine = lines.find((line) => line.startsWith("data:"));

      return {
        event: eventLine?.slice("event:".length).trim() ?? "message",
        data: dataLine?.slice("data:".length).trim() ?? "{}",
      };
    });
}

export async function streamChatMessage(
  request: ChatRequest,
  handlers: StreamHandlers,
): Promise<ChatResponse | null> {
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok || !response.body) {
    const errorPayload = await response.text();
    throw new Error(errorPayload || `Request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse: ChatResponse | null = null;

  const consumeEvents = (chunk: string) => {
    buffer += chunk;
    let boundaryIndex = buffer.indexOf("\n\n");

    while (boundaryIndex !== -1) {
      const eventBlock = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      for (const event of readSseEventStream(`${eventBlock}\n\n`)) {
        if (event.event === "token") {
          const payload = JSON.parse(event.data) as { token?: string };
          if (payload.token) {
            handlers.onToken(payload.token);
          }
        }

        if (event.event === "final") {
          const payload = JSON.parse(event.data) as ChatResponse | { response?: ChatResponse };
          const response =
            "response" in payload && payload.response ? payload.response : (payload as ChatResponse);

          if (response?.conversationId && typeof response.answer === "string") {
            finalResponse = response;
            handlers.onFinal(response);
          }
        }
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }
  };

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      if (buffer.trim()) {
        consumeEvents("\n\n");
      }
      break;
    }

    consumeEvents(decoder.decode(value, { stream: true }));
  }

  return finalResponse;
}
