import type { Pool } from 'pg';

import type {
  ConversationSummary,
  ConversationVideoContext,
  ConversationThread,
  ConversationTurn
} from '../../types/api.js';

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

  async getConversation(conversationId: string): Promise<ConversationTurn[]> {
    const result = await this.pool.query(
      `
        SELECT id, role, content, timestamp
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
      timestamp: row.timestamp.toISOString()
    }));
  }

  async listConversations(): Promise<ConversationSummary[]> {
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
        ORDER BY c.updated_at DESC, c.created_at DESC
      `
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

  async getConversationThread(conversationId: string): Promise<ConversationThread | null> {
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
      `,
      [conversationId]
    );

    if (conversationResult.rowCount === 0) {
      return null;
    }

    const turns = await this.getConversation(conversationId);
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

  async upsertConversationContext(conversationId: string, context: ConversationVideoContext) {
    await this.pool.query(
      `
        INSERT INTO conversations (conversation_id, contexts, active_context_index)
        VALUES ($1, $2::jsonb, 0)
        ON CONFLICT (conversation_id) DO UPDATE
          SET contexts = CASE
            WHEN jsonb_typeof(conversations.contexts) = 'array' THEN jsonb_build_array($2::jsonb) || conversations.contexts
            ELSE $2::jsonb
          END,
          active_context_index = 0,
          updated_at = now()
      `,
      [conversationId, JSON.stringify(context)]
    );
  }

  async updateActiveContextIndex(conversationId: string, activeContextIndex: number) {
    await this.pool.query(
      `
        UPDATE conversations
        SET active_context_index = GREATEST($2, 0),
            updated_at = now()
        WHERE conversation_id = $1
      `,
      [conversationId, activeContextIndex]
    );
  }

  async getActiveContext(conversationId: string) {
    const thread = await this.getConversationThread(conversationId);
    if (!thread) {
      return null;
    }

    return currentContext(thread.contexts, thread.activeContextIndex);
  }

  async updateConversationTitle(conversationId: string, title: string) {
    const normalizedTitle = normalizeTitle(title);

    await this.pool.query(
      `
        UPDATE conversations
        SET title = $2,
            updated_at = now()
        WHERE conversation_id = $1
      `,
      [conversationId, normalizedTitle]
    );

    return normalizedTitle;
  }

  async deleteConversation(conversationId: string) {
    await this.pool.query('DELETE FROM conversations WHERE conversation_id = $1', [conversationId]);
  }

  async appendTurn(
    conversationId: string,
    turn: Omit<ConversationTurn, 'id'>,
    options?: { title?: string; context?: ConversationVideoContext }
  ) {
    const title = options?.title ? normalizeTitle(options.title) : '';

    await this.pool.query(
      `
        INSERT INTO conversations (conversation_id, title)
        VALUES ($1, COALESCE($2, ''))
        ON CONFLICT (conversation_id) DO UPDATE
          SET title = CASE
            WHEN conversations.title = '' AND EXCLUDED.title <> '' THEN EXCLUDED.title
            ELSE conversations.title
          END
      `,
      [conversationId, title]
    );

    if (options?.context) {
      await this.upsertConversationContext(conversationId, options.context);
    }

    await this.pool.query(
      `
        INSERT INTO conversation_turns (conversation_id, role, content, timestamp)
        VALUES ($1, $2, $3, $4)
      `,
      [conversationId, turn.role, turn.content, turn.timestamp]
    );

    await this.pool.query('UPDATE conversations SET updated_at = now() WHERE conversation_id = $1', [conversationId]);

    if (options?.title) {
      await this.updateConversationTitle(conversationId, options.title);
    }
  }
}

