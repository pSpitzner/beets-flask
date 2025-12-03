/**
 * Bandcamp sync API client
 *
 * Provides functions for interacting with the bandcamp sync endpoints:
 * - Get sync status
 * - Start a sync operation
 * - Abort a sync operation
 * - Get configuration
 *
 * Progress updates are received via WebSocket (bandcamp_sync_update event).
 */

import { queryOptions } from "@tanstack/react-query";

export interface BandcampConfig {
    enabled: boolean;
    path: string;
}

export interface SyncStatus {
    status: "idle" | "pending" | "running" | "complete" | "error" | "aborted";
    error?: string;
}

/**
 * Query options for fetching current sync status
 */
export const bandcampStatusQueryOptions = () =>
    queryOptions({
        queryKey: ["bandcamp", "status"],
        queryFn: async () => {
            const response = await fetch(`/bandcamp/status`);
            return (await response.json()) as SyncStatus;
        },
        refetchInterval: false, // Don't auto-refetch, we use WebSocket for updates
    });

/**
 * Start a bandcamp sync operation
 */
export async function startBandcampSync(cookies: string): Promise<{ started: boolean; message?: string }> {
    const response = await fetch(`/bandcamp/sync`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ cookies }),
    });

    const data = (await response.json()) as { started: boolean; message?: string };
    
    if (!response.ok && response.status !== 409) {
        throw new Error(data.message ?? "Failed to start sync");
    }

    return data;
}

/**
 * Abort the current bandcamp sync operation
 */
export async function abortBandcampSync(): Promise<{ aborted: boolean }> {
    const response = await fetch(`/bandcamp/sync`, {
        method: "DELETE",
    });

    return (await response.json()) as { aborted: boolean };
}
