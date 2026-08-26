export type AccountSignInUser = {
  id: string;
  isAnonymous?: boolean;
};

type AccountSignInResult = {
  error?: { code?: string } | null;
};

type AccountSignInAttempt<T extends AccountSignInResult> = () => Promise<T>;

const EXISTING_ACCOUNT_CONFLICT = 'target_has_application_state';

/**
 * Existing accounts keep their own data. Once Better Auth proves the supplied
 * credential belongs to an existing account with state, discard anonymous A
 * and retry the same sign-in without anonymous linking context.
 */
export async function retryExistingAccountSignIn<T extends AccountSignInResult>(
  previousUser: AccountSignInUser | null,
  attempt: AccountSignInAttempt<T>,
  discardAnonymousUser: (user: AccountSignInUser) => Promise<void>
): Promise<{ result: T; previousUser: AccountSignInUser | null }> {
  const result = await attempt();
  if (
    !previousUser?.isAnonymous ||
    result.error?.code !== EXISTING_ACCOUNT_CONFLICT
  ) {
    return { result, previousUser };
  }

  await discardAnonymousUser(previousUser);
  return { result: await attempt(), previousUser: null };
}
