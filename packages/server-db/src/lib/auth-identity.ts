import { eq } from 'drizzle-orm';

import type { Database } from './client.js';
import { account, session, user } from './schema.js';

type User = typeof user.$inferSelect;

export interface PromoteAnonymousUserInput {
  anonymousUserId: string;
  temporaryUserId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
}

/**
 * Move a newly-created Better Auth identity onto an existing anonymous user.
 *
 * The child-row reassignment, temporary-user deletion, and anonymous-user
 * promotion must commit together. In particular, deleting the temporary user
 * outside this transaction can strand its credential account after a later
 * failure.
 */
export async function promoteAnonymousUserIdentity(
  db: Database,
  input: PromoteAnonymousUserInput
): Promise<User> {
  if (input.anonymousUserId === input.temporaryUserId) {
    throw new Error('Anonymous and temporary user ids must be different');
  }

  return db.transaction(async (transaction) => {
    await transaction
      .update(account)
      .set({ userId: input.anonymousUserId })
      .where(eq(account.userId, input.temporaryUserId));

    await transaction
      .update(session)
      .set({ userId: input.anonymousUserId })
      .where(eq(session.userId, input.temporaryUserId));

    const deletedUsers = await transaction
      .delete(user)
      .where(eq(user.id, input.temporaryUserId))
      .returning({ id: user.id });
    if (deletedUsers.length !== 1) {
      throw new Error('Temporary user was not found during identity promotion');
    }

    const promotedUsers = await transaction
      .update(user)
      .set({
        email: input.email,
        name: input.name,
        emailVerified: input.emailVerified,
        isAnonymous: false,
        ...(input.image !== undefined ? { image: input.image } : {}),
      })
      .where(eq(user.id, input.anonymousUserId))
      .returning();
    const promotedUser = promotedUsers[0];
    if (!promotedUser) {
      throw new Error('Anonymous user was not found during identity promotion');
    }

    return promotedUser;
  });
}
