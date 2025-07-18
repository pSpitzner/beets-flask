import { queryOptions, UseMutationOptions } from "@tanstack/react-query";

import {
    PushSettings,
    PushSubscription as PyPushSubscription,
    PushWebHook as PyPushWebHook,
} from "@/pythonTypes";

import { APIError, queryClient } from "./common";

class PushSubscriptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PushSubscriptionError";
    }
}

/* -------------------------------- webhooks -------------------------------- */

export interface PushWebHookSubscribeRequest
    extends Omit<PyPushWebHook, "settings" | "id" | "created_at" | "updated_at"> {
    settings: null | PushSettings;
    id?: string; // Optional ID for upsert
}

/** Upsert a webhook
 * can be used to update an existing webhook or create a new one.
 */
export const subscribeWebhookMutationOptions: UseMutationOptions<
    PyPushWebHook,
    APIError | PushSubscriptionError,
    PushWebHookSubscribeRequest
> = {
    mutationKey: ["webhook", "upsert"],
    mutationFn: async (params: PushWebHookSubscribeRequest) => {
        const response = await fetch("/notifications/webhook/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        });
        if (!response.ok) {
            throw new PushSubscriptionError(
                `Failed to subscribe webhook: ${response.statusText}`
            );
        }
        const webHook = (await response.json()) as PyPushWebHook;

        // We might have some webhook data in the cache already
        queryClient.setQueryData<PyPushWebHook>(
            webhookQueryOptions(webHook.id).queryKey,
            webHook
        );

        // TODO: Update the infinite query for webhooks

        return (await response.json()) as PyPushWebHook;
    },
};

/** Remove a webhook */
export const unsubscribeWebhookMutationOptions: UseMutationOptions<
    void,
    APIError | PushSubscriptionError,
    string
> = {
    mutationKey: ["webhook", "unsubscribe"],
    mutationFn: async (id: string) => {
        await fetch(`/notifications/webhook/${id}`, {
            method: "DELETE",
        });
        queryClient.removeQueries(webhookQueryOptions(id));

        // TODO: Update the infinite query for webhooks
    },
};

export const webhookQueryOptions = (id: string) =>
    queryOptions<PyPushWebHook, APIError>({
        queryKey: ["webhook", id],
        queryFn: async () => {
            const response = await fetch(`/notifications/webhook/${id}`);

            return (await response.json()) as PyPushWebHook;
        },
    });

// TODO: Infinity query for all webhooks

/* ------------------------------ web push api ------------------------------ */

export interface PushSubscriptionUpsertRequest
    extends Omit<PyPushSubscription, "settings" | "id" | "created_at" | "updated_at"> {
    settings: null | PushSettings;
    endpoint: string;
}

export interface PushSubscriptionReturn {
    server: PyPushSubscription;
    subscription: PushSubscription;
}

/** Subscribing using a web hook is a bit more difficult in comparison
 * to adding a webhook.
 *
 * We need to do a key exchange with the server to get the public VAPID key
 * and then use the PushManager to subscribe to the push notifications.
 * Per VAPID key their can only be one subscription, so we dont need to
 * pass the id.
 *
 * We expect this function to be called in the main thread, not in a service worker.
 */
export const subscribePushMutationOptions: UseMutationOptions<
    PushSubscriptionReturn,
    APIError | PushSubscriptionError
> = {
    mutationKey: ["subscription", "upsert"],
    mutationFn: async () => {
        // Get server's public VAPID key
        const keyResponse = await fetch("/notifications/vapid_key");
        const { key } = (await keyResponse.json()) as { key: string };

        // Get pushManager from the service worker registration
        const registration = await navigator.serviceWorker.ready;
        if (!registration.pushManager) {
            console.warn(
                "Push Manager is not available in this service worker registration.",
                registration
            );
            throw new PushSubscriptionError("PushManager unavailable");
        }

        // Subscribe to push notifications using the PushManager
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key, // This is the public vapid key
        });

        // Send the subscription to the server to allow the server to
        // send notifications
        const response = await fetch("/notifications/subscription/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(subscription.toJSON()),
        });

        return {
            server: (await response.json()) as PyPushSubscription,
            subscription,
        };
    },
};

export const unsubscribePushMutationOptions: UseMutationOptions<
    void,
    APIError | PushSubscriptionError
> = {
    mutationKey: ["subscription", "unsubscribe"],
    mutationFn: async () => {
        // Get pushManager from the service worker registration
        const registration = await navigator.serviceWorker.ready;
        if (!registration.pushManager) {
            console.warn(
                "Push Manager is not available in this service worker registration.",
                registration
            );
            throw new PushSubscriptionError("PushManager unavailable");
        }

        // Get the current subscription
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            console.warn("No push subscription found.");
            return;
        }

        // Notify the server that we unsubscribed
        await fetch(`/notifications/${encodeURIComponent(subscription.endpoint)}`, {
            method: "DELETE",
        });
        await invalidatePushQuery();

        // Unsubscribe from push notifications locally
        await subscription.unsubscribe();
    },
};

/** Push subscription for the current service worker registration.
 *
 * This does not do a network request, it is just a helper function to get the
 * PushManager from the service worker registration.
 *
 * May return null if there is no registered push subscription!
 */
export const pushQueryOptions = queryOptions<
    PushSubscriptionReturn | null,
    APIError | PushSubscriptionError
>({
    queryKey: ["subscription"],
    queryFn: async () => {
        if (!("serviceWorker" in navigator)) {
            console.warn(
                "Service Worker and therefore Push Notifications are not supported in this browser."
            );
            throw new PushSubscriptionError(`Browser lacks Service Worker support. Please use a
                modern browser that supports the Push API. You might need to host this application
                on a secure context (HTTPS or use localhost).`);
        }

        // Get pushManager from the service worker registration
        const registration = await navigator.serviceWorker.ready;
        if (!registration.pushManager) {
            console.warn(
                "Push Manager is not available in this service worker registration.",
                registration
            );
            throw new PushSubscriptionError("PushManager unavailable.");
        }

        const localSubscription = await registration.pushManager.getSubscription();

        if (!localSubscription) {
            console.warn("No push subscription found.");
            return null;
        }

        // Get the server subscription
        const response = await fetch(
            `/notifications/${encodeURIComponent(localSubscription.endpoint)}`
        );
        const data = (await response.json()) as PyPushSubscription;
        return {
            server: data,
            subscription: localSubscription,
        };
    },
    staleTime: Infinity,
    retry: false,
});

async function invalidatePushQuery() {
    await queryClient
        .cancelQueries(pushQueryOptions)
        .then(() => queryClient.invalidateQueries(pushQueryOptions));
}
