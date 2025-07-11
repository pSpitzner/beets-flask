import { queryOptions, UseMutationOptions } from "@tanstack/react-query";

import { APIError, queryClient } from "./common";

export const subscribeMutationOptions: UseMutationOptions<
    string,
    APIError | PushSubscriptionError
> = {
    mutationKey: ["subscribe"],
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
        await invalidatePushSubscriptionQuery(subscription);

        // Send the subscription to the server to allow the server to
        // send notifications
        const response = await fetch("/notifications/subscribe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(subscription.toJSON()),
        });
        console.log("Subscription response:", response);
        return (await response.json()) as string;
    },
};

export const unsubscribeMutationOptions: UseMutationOptions<
    void,
    APIError | PushSubscriptionError
> = {
    mutationKey: ["unsubscribe"],
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
        await fetch("/notifications/unsubscribe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(subscription.toJSON()),
        });

        // Unsubscribe from push notifications locally
        await subscription.unsubscribe();
        await invalidatePushSubscriptionQuery(null);

        return;
    },
};

/** Push subscription for the current service worker registration.
 *
 * This does not do a network request, it is just a helper function to get the
 * PushManager from the service worker registration.
 *
 * May return null if there is no registered push subscription!
 */
export const pushSubscriptionQueryOptions = queryOptions<
    PushSubscription | null,
    PushSubscriptionError
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

        return await registration.pushManager.getSubscription();
    },
    staleTime: Infinity,
    retry: false,
});

async function invalidatePushSubscriptionQuery(data?: PushSubscription | null) {
    if (data !== undefined) {
        queryClient.setQueryData(pushSubscriptionQueryOptions.queryKey, data);
    }
    await queryClient
        .cancelQueries(pushSubscriptionQueryOptions)
        .then(() => queryClient.invalidateQueries(pushSubscriptionQueryOptions));
}

class PushSubscriptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PushSubscriptionError";
    }
}
