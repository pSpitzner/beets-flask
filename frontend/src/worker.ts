/** Service worker. injected with vite-pwa-plugin */
/// <reference lib="webworker" />

import { PushNotification, PushNotificationOptions } from "./pythonTypes/notifications";

// Trickery to get the correct type for the service worker global scope
const worker: ServiceWorkerGlobalScope = self as unknown as ServiceWorkerGlobalScope;

/** Handles if we receive push notifications.
 * This should be called if our server sends a push message.
 */
worker.addEventListener("push", (event) => {
    const data: PushNotification | null =
        (event.data?.json() as PushNotification) ?? null;

    console.debug("Push event received:", event, data);

    // This should not happen, but if it does, we log a warning and show a generic notification
    if (!data) {
        console.warn("Push message without data", event);
        return worker.registration.showNotification("Huh?");
    }

    event.waitUntil(
        isClientFocused().then((clientIsFocused) => {
            // If the client is focused, we don't need to show a notification
            if (clientIsFocused) {
                console.debug("Client is focused, not showing notification.");
                return;
            } else {
                try {
                    return worker.registration.showNotification(
                        data.title,
                        (data.options as NotificationOptions) || undefined
                    );
                } catch (error) {
                    console.error("Error showing notification:", error);
                }
            }
        })
    );
});

/** Handles notification clicks.
 * Called if the user clicks on a notification.
 */
worker.addEventListener("notificationclick", (event) => {
    const data = event.notification.data as PushNotificationOptions["data"];
    const clickedNotification = event.notification;

    if (!data) {
        console.warn("Notification click without data", event);
        event.waitUntil(openUrl("/"));
        clickedNotification.close();
        return;
    }

    switch (event.action) {
        case "open-inbox-details":
            // If the action is to open inbox details, we open the folder
            // with the specified path and hash
            if (data.path && data.hash) {
                event.waitUntil(openInboxFolder(data.path, data.hash));
            } else {
                console.warn(
                    "Notification click with open-inbox-details action but no path or hash",
                    event
                );
            }
            break;
        case "open-inbox":
            // If the action is to open the inbox, we just open the inbox page
            event.waitUntil(openUrl("/inbox"));
            break;
        default:
            // If no action is specified, we just open the homepage
            event.waitUntil(openUrl("/"));
            break;
    }

    clickedNotification.close();
});

/** Handle service worker update
 * This is called when the service worker needs to be updated i.e. service worker file changed.
 */
worker.addEventListener("message", async (event) => {
    console.debug("Service worker message received:", event);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (event.data && event.data.type === "SKIP_WAITING") {
        await worker.skipWaiting();
    }
});

/* --------------------------------- helpers -------------------------------- */

/** Open the inbox details for a specific
 * folder path and hash in the browser.
 */
async function openInboxFolder(path: string, hash: string) {
    const allClients = await worker.clients.matchAll({
        type: "window",
    });

    // See if we already have a client open that can handle the request
    const clientMatch = allClients.find((client) => {
        const url = new URL(client.url);
        return (
            url.pathname.startsWith("/inbox/folder/") &&
            url.pathname.includes(encodeURIComponent(path))
        );
    });
    if (clientMatch) {
        await clientMatch.focus();
        return;
    }

    // If we don't have a client open, let's open a new one
    await worker.clients.openWindow(
        `/inbox/folder/${encodeURIComponent(path)}/${encodeURIComponent(hash)}`
    );
}

async function openUrl(url: string) {
    const allClients = await worker.clients.matchAll({
        type: "window",
    });

    // See if we already have a client open that can handle the request
    const clientMatch = allClients.find((client) => {
        const clientUrl = new URL(client.url);
        return clientUrl.pathname === url;
    });

    if (clientMatch) {
        // If we found a matching client, focus it
        await clientMatch.focus();
    } else {
        // If not, open a new window with the URL
        await worker.clients.openWindow(url);
    }
}

/** Checks if a client is currently focused */
function isClientFocused() {
    return worker.clients
        .matchAll({
            type: "window",
            includeUncontrolled: true,
        })
        .then((windowClients) => {
            let clientIsFocused = false;

            for (let i = 0; i < windowClients.length; i++) {
                const windowClient = windowClients[i];
                if (windowClient.focused) {
                    clientIsFocused = true;
                    break;
                }
            }

            return clientIsFocused;
        });
}
