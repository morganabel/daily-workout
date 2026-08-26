export interface AuthenticatedUserState {
  id: string;
  isAnonymous?: boolean;
}

export interface LinkedAccountState {
  providerId: string;
  userId: string;
}

/**
 * OAuth browser completion alone is not proof of authentication. The browser
 * may have been cancelled or may have returned without a session cookie.
 */
export function hasCompletedGoogleSignIn(
  previousUser: AuthenticatedUserState | null | undefined,
  currentUser: AuthenticatedUserState | undefined,
  accounts: LinkedAccountState[]
): boolean {
  if (!currentUser || currentUser.isAnonymous) {
    return false;
  }

  return accounts.some(
    (account) =>
      account.providerId === 'google' && account.userId === currentUser.id
  );
}
