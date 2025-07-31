import {
    infiniteQueryOptions,
    queryOptions,
    UseMutationOptions,
} from "@tanstack/react-query";

import {
    PushSubscription as PyPushSubscription,
    SubscriptionSettings,
    WebhookSubscription,
} from "@/pythonTypes/notifications";

import { APIError, queryClient } from "./common";

export class PushSubscriptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PushSubscriptionError";
    }
}

/* -------------------------------- webhooks -------------------------------- */

export interface WebhookSubscribeRequest
    extends Omit<
        WebhookSubscription,
        "settings" | "id" | "created_at" | "updated_at" | "type"
    > {
    settings: null | SubscriptionSettings;
    id?: string; // Optional ID for upsert
}

/** Upsert a webhook
 * can be used to update an existing webhook or create a new one.
 */
export const upsertWebhookMutationOptions: UseMutationOptions<
    WebhookSubscription,
    APIError | PushSubscriptionError,
    WebhookSubscribeRequest
> = {
    mutationKey: ["webhook", "upsert"],
    mutationFn: async (params: WebhookSubscribeRequest | WebhookSubscription) => {
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

        return (await response.json()) as WebhookSubscription;
    },
    onSuccess: async (data) => {
        await queryClient.invalidateQueries(webhookQueryOptions(data.id));
        await queryClient.invalidateQueries(webhooksInfiniteQueryOptions());
    },
    onMutate: (params) => {
        // if id is given we do an update, otherwise we do an insert
        if (!params.id) {
            return;
        }

        // Update the id cache optimistically
        const dataBefore = queryClient.getQueryData<WebhookSubscription>(
            webhookQueryOptions(params.id).queryKey
        );
        if (dataBefore) {
            queryClient.setQueryData<WebhookSubscription>(
                webhookQueryOptions(params.id).queryKey,
                {
                    ...dataBefore,
                    ...params,
                    settings: params.settings || dataBefore.settings,
                }
            );
        }

        // Update the webhooks list cache optimistically
        const currentWebhooks = queryClient.getQueryData(
            webhooksInfiniteQueryOptions().queryKey
        );

        if (currentWebhooks) {
            console.log("Updating webhooks list cache optimistically", currentWebhooks);
            const updatedWebhooks = currentWebhooks.pages.map((page) => {
                return {
                    ...page,
                    items: page.items.map((webhook) =>
                        webhook.id === params.id
                            ? {
                                  ...webhook,
                                  ...params,
                                  settings: params.settings || webhook.settings,
                              }
                            : webhook
                    ),
                };
            });
            queryClient.setQueryData(webhooksInfiniteQueryOptions().queryKey, {
                ...currentWebhooks,
                pages: updatedWebhooks,
            });
        }
    },
};

/** Remove a webhook */
export const deleteWebhookMutationOptions: UseMutationOptions<
    void,
    APIError | PushSubscriptionError,
    string
> = {
    mutationKey: ["webhook", "delete"],
    mutationFn: async (id: string) => {
        await fetch(`/notifications/webhook/id/${id}`, {
            method: "DELETE",
        });
        queryClient.removeQueries(webhookQueryOptions(id));

        await queryClient.invalidateQueries(webhooksInfiniteQueryOptions());
    },
};

export const webhookQueryOptions = (id: string) =>
    queryOptions<WebhookSubscription, APIError>({
        queryKey: ["webhook", id],
        queryFn: async () => {
            const response = await fetch(`/notifications/webhook/id/${id}`);

            return (await response.json()) as WebhookSubscription;
        },
    });

export const webhooksInfiniteQueryOptions = () => {
    const params = new URLSearchParams();
    params.set("n_items", "20"); // Set the number of items per page

    const initUrl = `/notifications/webhook/?${params.toString()}`;

    return infiniteQueryOptions({
        queryKey: ["webhooks"],
        queryFn: async ({ pageParam }) => {
            const response = await fetch(pageParam.replace("/api_v1", ""));

            return (await response.json()) as {
                items: WebhookSubscription[];
                next: string | null;
            };
        },
        initialPageParam: initUrl,
        getNextPageParam: (lastPage) => lastPage.next,
        select: (data) => {
            console.log("Selected webhooks data", data);
            return data.pages.flatMap((p) => p.items || []);
        },
    });
};

export const testWebhookMutationOptions: UseMutationOptions<
    { status: "ok" } | { status: "error"; error: string },
    APIError | PushSubscriptionError,
    WebhookSubscribeRequest
> = {
    mutationKey: ["webhook", "test"],
    mutationFn: async (data: WebhookSubscribeRequest | WebhookSubscription) => {
        const response = await fetch(`/notifications/webhook/test`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        const result = (await response.json()) as
            | { status: "ok" }
            | { status: "error"; error: string };
        console.log("Test webhook result", result);
        return result;
    },
};

/* ------------------------------ web push api ------------------------------ */

export interface PushSubscriptionUpsertRequest
    extends Omit<PyPushSubscription, "settings" | "id" | "created_at" | "updated_at"> {
    settings: null | SubscriptionSettings;
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

        const sub = {
            server: (await response.json()) as PyPushSubscription,
            subscription,
        };
        await invalidatePushQuery(sub);
        return sub;
    },
};

export const updatePushMutationOptions: UseMutationOptions<
    PushSubscriptionReturn,
    APIError | PushSubscriptionError,
    SubscriptionSettings
> = {
    mutationKey: ["subscription", "update"],
    mutationFn: async (settings: SubscriptionSettings) => {
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
            throw new PushSubscriptionError("No push subscription found.");
        }
        // Notify the server that we updated the subscription
        const response = await fetch(`/notifications/subscription`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...subscription.toJSON(),
                settings,
            } as PushSubscriptionUpsertRequest),
        });

        return {
            server: (await response.json()) as PyPushSubscription,
            subscription,
        };
    },
    onMutate: (settings) => {
        // Optimistically update the subscription in the cache
        const currentSubscription = queryClient.getQueryData<PushSubscriptionReturn>(
            pushQueryOptions.queryKey
        );
        if (currentSubscription) {
            const updatedSubscription = {
                ...currentSubscription,
                server: {
                    ...currentSubscription.server,
                    settings,
                },
            };
            queryClient.setQueryData<PushSubscriptionReturn>(
                pushQueryOptions.queryKey,
                updatedSubscription
            );
        }
    },
    onSettled: async (data) => {
        // Invalidate the query to ensure we have the latest data
        await invalidatePushQuery(data);
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
        await fetch(
            `/notifications/subscription/id/${encodeURIComponent(subscription.endpoint)}`,
            {
                method: "DELETE",
            }
        );
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
            `/notifications/subscription/id/${encodeURIComponent(localSubscription.endpoint)}`
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

async function invalidatePushQuery(sub: PushSubscriptionReturn | null = null) {
    queryClient.setQueryData<PushSubscriptionReturn | null>(
        pushQueryOptions.queryKey,
        sub
    );

    await queryClient
        .cancelQueries(pushQueryOptions)
        .then(() => queryClient.invalidateQueries(pushQueryOptions));
}
