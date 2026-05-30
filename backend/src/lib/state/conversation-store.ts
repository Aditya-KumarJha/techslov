export type ConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

import type { Pool } from 'pg';

export class ConversationStore {
  constructor(private readonly pool: Pool) {}

  async getConversation(conversationId: string): Promise<ConversationTurn[]> {
    const result = await this.pool.query(
      `
        SELECT role, content, timestamp
        FROM conversation_turns
        WHERE conversation_id = $1
        ORDER BY timestamp ASC, id ASC
      `,
      [conversationId]
    );

    return result.rows.map((row) => ({
      role: row.role,
      content: row.content,
      timestamp: row.timestamp.toISOString()
    }));
  }

  async appendTurn(conversationId: string, turn: ConversationTurn) {
    await this.pool.query('INSERT INTO conversations (conversation_id) VALUES ($1) ON CONFLICT DO NOTHING', [
      conversationId
    ]);

    await this.pool.query(
      `
        INSERT INTO conversation_turns (conversation_id, role, content, timestamp)
        VALUES ($1, $2, $3, $4)
      `,
      [conversationId, turn.role, turn.content, turn.timestamp]
    );

    await this.pool.query('UPDATE conversations SET updated_at = now() WHERE conversation_id = $1', [conversationId]);
  }
}

