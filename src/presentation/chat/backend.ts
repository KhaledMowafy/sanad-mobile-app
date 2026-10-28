import type { UsageSnapshotDto } from '@/application/dto/dto';
import type { AppError } from '@/application/errors';

/**
 * The use cases, loaded when first needed. The chat store imports this folder's clients, and the
 * store is tested in plain Node, where the secure storage of a phone does not exist.
 */
export async function loadUseCases() {
  const { getContainer } = await import('@/infrastructure/di/container');
  return getContainer().useCases;
}

/** A failure reduced to a stable code the screens translate, with the figures behind a refusal. */
export function problemOf(error: AppError): { code: string; usage: UsageSnapshotDto | null } {
  switch (error.kind) {
    case 'validation':
      return {
        code:
          error.fields.file ??
          error.fields.prompt ??
          Object.values(error.fields)[0] ??
          'invalid_request',
        usage: null,
      };
    case 'unauthenticated':
      return { code: 'unauthenticated', usage: null };
    case 'forbidden':
      return { code: error.code ?? 'forbidden', usage: null };
    case 'not_found':
      return { code: 'not_found', usage: null };
    case 'quota':
      return { code: `limit_${error.limit}`, usage: error.usage };
    case 'rate_limited':
      return { code: 'rate_limited', usage: null };
    case 'network':
      return { code: 'network', usage: null };
    default:
      return { code: 'server_error', usage: null };
  }
}
