export class StorageClientError extends Error {
    status?: number;
    details?: unknown;
    recoveryAvailable?: boolean;
}
export function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message || fallback : fallback;
}
