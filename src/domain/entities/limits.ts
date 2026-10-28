/** Limits the server states. Read them from GET /limits; the defaults are only a fallback. */
export interface UsageLimits {
  readonly conversationTokens: number | null;
  readonly conversationMessages: number | null;
  readonly monthlyTokens: number | null;
  /** Fraction of a limit at which a warning shows. */
  readonly warnAt: number;
  readonly questionMaxChars: number;
  readonly attachments: {
    readonly perConversation: number;
    readonly perDraft: number;
    readonly maxBytes: number;
    readonly pagesRead: number;
    readonly suffixes: readonly string[];
  };
}

/** Used in demo mode and when GET /limits cannot be read. The server's numbers win. */
export const DEFAULT_LIMITS: UsageLimits = {
  conversationTokens: null,
  conversationMessages: null,
  monthlyTokens: null,
  warnAt: 0.8,
  questionMaxChars: 4000,
  attachments: {
    perConversation: 10,
    perDraft: 10,
    maxBytes: 10 * 1024 * 1024,
    pagesRead: 10,
    suffixes: [
      '.png',
      '.jpg',
      '.jpeg',
      '.webp',
      '.tif',
      '.tiff',
      '.bmp',
      '.pdf',
      '.docx',
      '.dotx',
      '.txt',
      '.md',
      '.csv',
    ],
  },
};
