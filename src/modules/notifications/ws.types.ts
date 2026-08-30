import type { Socket } from 'socket.io';

/**
 * What this server attaches to a connected socket.
 *
 * `socket.io` types `handshake.auth` and `socket.data` as `any`, so every read of
 * them is an unchecked assumption. Declaring the shape once here means the compiler
 * checks each use instead, and the alternative — a cast at every call site — is how
 * `client.data.userId` quietly becomes a number one day.
 *
 * `userId` is set only after `WsAuthService.authenticate()` has verified the token,
 * which is why it is optional: a socket exists before it is authenticated.
 */
export interface UzaSocketData {
  userId?: string;
}

/** The handshake fields a client may send a token in. All untrusted. */
export interface UzaHandshakeAuth {
  token?: unknown;
}

export type UzaSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  UzaSocketData
>;
