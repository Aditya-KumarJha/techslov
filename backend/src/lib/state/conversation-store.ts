import type { Pool } from 'pg';

import type {
  Citation,
  ConversationSummary,
  ConversationVideoContext,
  ConversationThread,
  ConversationTurn
} from '../../types/api.js';

type StoredConversationTurn = ConversationTurn & {
  citations?: Citation[];
};

type ConversationOwnership = {
  conversationId: string;
  clerkUserId: string | null;
};

function normalizeTitle(title: string) {
  const cleaned = title.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    return 'New chat';
  }

  if (cleaned.length <= 64) {
    return cleaned;
  }

  return `${cleaned.slice(0, 61).trimEnd()}...`;
}

function normalizeContexts(value: unknown): ConversationVideoContext[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ConversationVideoContext => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      contextId: String(item.contextId),
      createdAt: String(item.createdAt),
      videoA: item.videoA,
      videoB: item.videoB
    }));
}

function currentContext(contexts: ConversationVideoContext[], activeContextIndex: number) {
  return contexts[activeContextIndex] ?? contexts[0] ?? null;
}

export class ConversationStore {
  constructor(private readonly pool: Pool) {}

  private async getOwnership(conversationId: string): Promise<ConversationOwnership | null> {
    const result = await this.pool.query(
      `
        SELECT conversation_id AS "conversationId", clerk_user_id AS "clerkUserId"
        FROM conversations
        WHERE conversation_id = $1
      `,
      [conversationId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0] as ConversationOwnership;
  }

  private async assertAccess(conversationId: string, clerkUserId: string | null) {
    const ownership = await this.getOwnership(conversationId);

    if (!ownership) {
      return false;
    }

    return ownership.clerkUserId === clerkUserId;
  }

  async getConversation(conversationId: string, clerkUserId: string | null): Promise<ConversationTurn[]> {
    const canAccess = await this.assertAccess(conversationId, clerkUserId);

    if (!canAccess) {
      return [];
    }

    const result = await this.pool.query(
      `
        SELECT id, role, content, timestamp, citations, transcript_evidence
        FROM conversation_turns
        WHERE conversation_id = $1
        ORDER BY timestamp ASC, id ASC
      `,
      [conversationId]
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      role: row.role,
      content: row.content,
      timestamp: row.timestamp.toISOString(),
      citations: Array.isArray(row.citations) ? row.citations : undefined,
      transcriptEvidence: Array.isArray(row.transcript_evidence) ? row.transcript_evidence : undefined
    }));
  }

  async listConversations(clerkUserId: string | null): Promise<ConversationSummary[]> {
    if (!clerkUserId) {
      return [];
    }

    const result = await this.pool.query(
      `
        SELECT
          c.conversation_id AS "conversationId",
          COALESCE(NULLIF(c.title, ''), (
            SELECT t.content
            FROM conversation_turns t
            WHERE t.conversation_id = c.conversation_id AND t.role = 'user'
            ORDER BY t.timestamp ASC, t.id ASC
            LIMIT 1
          ), 'New chat') AS title,
          c.created_at AS "createdAt",
          c.updated_at AS "updatedAt",
          COALESCE((
            SELECT COUNT(*)
            FROM conversation_turns t
            WHERE t.conversation_id = c.conversation_id
          ), 0) AS "turnCount",
          COALESCE((
            SELECT left(t.content, 120)
            FROM conversation_turns t
            WHERE t.conversation_id = c.conversation_id
            ORDER BY t.timestamp DESC, t.id DESC
            LIMIT 1
          ), 'No messages yet') AS preview,
          c.active_context_index AS "activeContextIndex",
          COALESCE(jsonb_array_length(c.contexts), 0) AS "contextCount"
        FROM conversations c
        WHERE c.clerk_user_id = $1
        ORDER BY c.updated_at DESC, c.created_at DESC
      `,
      [clerkUserId]
    );

    return result.rows.map((row) => ({
      conversationId: row.conversationId,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      turnCount: Number(row.turnCount),
      preview: row.preview,
      activeContextIndex: Number(row.activeContextIndex),
      contextCount: Number(row.contextCount)
    }));
  }

  async getConversationThread(conversationId: string, clerkUserId: string | null): Promise<ConversationThread | null> {
    const conversationResult = await this.pool.query(
      `
        SELECT
          conversation_id AS "conversationId",
          COALESCE(NULLIF(title, ''), (
            SELECT t.content
            FROM conversation_turns t
            WHERE t.conversation_id = conversations.conversation_id AND t.role = 'user'
            ORDER BY t.timestamp ASC, t.id ASC
            LIMIT 1
          ), 'New chat') AS title,
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          COALESCE((
            SELECT COUNT(*)
            FROM conversation_turns t
            WHERE t.conversation_id = conversations.conversation_id
          ), 0) AS "turnCount",
          COALESCE((
            SELECT left(t.content, 120)
            FROM conversation_turns t
            WHERE t.conversation_id = conversations.conversation_id
            ORDER BY t.timestamp DESC, t.id DESC
            LIMIT 1
          ), 'No messages yet') AS preview,
          contexts,
          active_context_index AS "activeContextIndex"
        FROM conversations
        WHERE conversation_id = $1
          AND clerk_user_id = $2
      `,
      [conversationId, clerkUserId]
    );

    if (conversationResult.rowCount === 0) {
      return null;
    }

    const turns = await this.getConversation(conversationId, clerkUserId);
    const conversation = conversationResult.rows[0];
    const contexts = normalizeContexts(conversation.contexts);
    const activeContextIndex = Number(conversation.activeContextIndex);

    return {
      conversationId: conversation.conversationId,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      turnCount: Number(conversation.turnCount),
      preview: conversation.preview,
      activeContextIndex,
      contextCount: contexts.length,
      turns,
      contexts
    };
  }

  async upsertConversationContext(conversationId: string, clerkUserId: string, context: ConversationVideoContext) {
    await this.pool.query(
      `
        INSERT INTO conversations (conversation_id, clerk_user_id, contexts, active_context_index)
        VALUES ($1, $2, jsonb_build_array($3::jsonb), 0)
        ON CONFLICT (conversation_id) DO UPDATE
          SET contexts = CASE
            WHEN jsonb_typeof(conversations.contexts) = 'array' THEN jsonb_build_array($3::jsonb) || conversations.contexts
            ELSE jsonb_build_array($3::jsonb)
          END,
          active_context_index = 0,
          updated_at = now()
        WHERE conversations.clerk_user_id = $2
      `,
      [conversationId, clerkUserId, JSON.stringify(context)]
    );
  }

  async updateActiveContextIndex(conversationId: string, clerkUserId: string, activeContextIndex: number) {
    const result = await this.pool.query(
      `
        UPDATE conversations
        SET active_context_index = GREATEST($2, 0),
            updated_at = now()
        WHERE conversation_id = $1
          AND clerk_user_id = $3
      `,
      [conversationId, activeContextIndex, clerkUserId]
    );

    return Boolean(result.rowCount && result.rowCount > 0);
  }

  async getActiveContext(conversationId: string, clerkUserId: string | null) {
    const thread = await this.getConversationThread(conversationId, clerkUserId);
    if (!thread) {
      return null;
    }

    return currentContext(thread.contexts, thread.activeContextIndex);
  }

  async updateConversationTitle(conversationId: string, clerkUserId: string, title: string) {
    const normalizedTitle = normalizeTitle(title);
    const result = await this.pool.query(
      `
        UPDATE conversations
        SET title = $2,
            updated_at = now()
        WHERE conversation_id = $1
          AND clerk_user_id = $3
      `,
      [conversationId, normalizedTitle, clerkUserId]
    );

    return Boolean(result.rowCount && result.rowCount > 0) ? normalizedTitle : null;
  }

  async deleteConversation(conversationId: string, clerkUserId: string) {
    const result = await this.pool.query(
      'DELETE FROM conversations WHERE conversation_id = $1 AND clerk_user_id = $2',
      [conversationId, clerkUserId]
    );

    return Boolean(result.rowCount && result.rowCount > 0);
  }

  async appendTurn(
    conversationId: string,
    turn: Omit<ConversationTurn, 'id'>,
    options?: {
      clerkUserId?: string | null;
      persist?: boolean;
      title?: string;
      context?: ConversationVideoContext;
      citations?: Citation[];
      transcriptEvidence?: StoredConversationTurn['transcriptEvidence'];
    }
  ) {
    if (options?.persist === false) {
      return;
    }

    if (!options?.clerkUserId) {
      throw new Error('Authenticated user is required to persist conversations');
    }

    const ownership = await this.getOwnership(conversationId);
    if (ownership && ownership.clerkUserId !== options.clerkUserId) {
      throw new Error('Conversation history not found');
    }

    const title = options?.title ? normalizeTitle(options.title) : '';

    await this.pool.query(
      `
        INSERT INTO conversations (conversation_id, clerk_user_id, title)
        VALUES ($1, $2, COALESCE($3, ''))
        ON CONFLICT (conversation_id) DO UPDATE
          SET title = CASE
            WHEN conversations.title = '' AND EXCLUDED.title <> '' THEN EXCLUDED.title
            ELSE conversations.title
          END
        WHERE conversations.clerk_user_id = EXCLUDED.clerk_user_id
      `,
      [conversationId, options.clerkUserId, title]
    );

    if (options?.context) {
      await this.upsertConversationContext(conversationId, options.clerkUserId, options.context);
    }

    await this.pool.query(
      `
        INSERT INTO conversation_turns (conversation_id, role, content, timestamp, citations, transcript_evidence)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      `,
      [
        conversationId,
        turn.role,
        turn.content,
        turn.timestamp,
        JSON.stringify(turn.role === 'assistant' ? options?.citations ?? [] : []),
        JSON.stringify(turn.role === 'assistant' ? options?.transcriptEvidence ?? [] : [])
      ]
    );

    await this.pool.query(
      'UPDATE conversations SET updated_at = now() WHERE conversation_id = $1 AND clerk_user_id = $2',
      [conversationId, options.clerkUserId]
    );

    if (options?.title) {
      await this.updateConversationTitle(conversationId, options.clerkUserId, options.title);
    }
  }
}
