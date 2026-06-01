import type { FastifyRequest } from 'fastify';
import { clerkClient, getAuth } from '@clerk/fastify';

export type AuthenticatedUser = {
  clerkUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

export function getRequestUserId(request: FastifyRequest) {
  return getAuth(request).userId ?? null;
}

export async function getAuthenticatedUser(request: FastifyRequest): Promise<AuthenticatedUser | null> {
  const clerkUserId = getRequestUserId(request);

  if (!clerkUserId) {
    return null;
  }

  try {
    const user = await clerkClient.users.getUser(clerkUserId);
    const primaryEmail = user.emailAddresses.find(
      (emailAddress) => emailAddress.id === user.primaryEmailAddressId
    );

    return {
      clerkUserId,
      email: primaryEmail?.emailAddress ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      imageUrl: user.imageUrl ?? null
    };
  } catch {
    return {
      clerkUserId,
      email: null,
      firstName: null,
      lastName: null,
      imageUrl: null
    };
  }
}
