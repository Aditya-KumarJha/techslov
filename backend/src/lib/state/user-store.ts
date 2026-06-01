import type { Pool } from 'pg';

import type { AuthenticatedUser } from '../auth/auth.js';

export class UserStore {
  constructor(private readonly pool: Pool) {}

  async upsertUser(user: AuthenticatedUser) {
    await this.pool.query(
      `
        INSERT INTO app_users (
          clerk_user_id,
          email,
          first_name,
          last_name,
          image_url
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (clerk_user_id) DO UPDATE
          SET email = EXCLUDED.email,
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              image_url = EXCLUDED.image_url,
              updated_at = now()
      `,
      [user.clerkUserId, user.email, user.firstName, user.lastName, user.imageUrl]
    );
  }
}
