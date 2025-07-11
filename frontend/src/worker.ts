/** Service worker. injected with vite-pwa-plugin */
/// <reference lib="webworker" />

import { assertUnreachable } from "./components/common/debugging/typing";
import { TaggedNotification } from "./pythonTypes";

// Trickery to get the correct type for the service worker global scope
const worker: ServiceWorkerGlobalScope = self as unknown as ServiceWorkerGlobalScope;

type PushData = TaggedNotification;

// Typing is not up to date, e.g. actions are missing
interface NotificationOptionsEx extends NotificationOptions {
    actions?: {
        action: string;
        title: string;
        icon: string;
        type?: string; // Optional, but can be used to specify the type of action
    }[];
}

function pushDataToNotificationOptions(
    data: PushData
): [string, NotificationOptionsEx] {
    switch (data.type) {
        case "tagged":
            return [
                `Tagging '${data.path.replace(data.inboxPath || "", "...")}' completed!`,
                {
                    body: `Found ${data.nCandidates} candidates\n\tbest: ${data.bestCandidate} (${Math.round(data.bestCandidateMatch * 100)}%)`,
                    tag: data.hash, // Use the hash as the tag for uniqueness we can update the notification later if there
                    //an import
                    icon: "/logo_flask.svg",
                    actions: [
                        {
                            action: "open-folder",
                            title: "Review tagged folder",
                            icon: "/tag.svg",
                        },
                    ],
                },
            ];
        default:
            return assertUnreachable(data.type);
    }
}
/** Handles if we receive push notifications.
 * This should be called if our server sends a push message.
 */
worker.addEventListener("push", (event) => {
    const data: PushData | null = (event.data?.json() as PushData) ?? null;

    if (!data) {
        // This should not happen, but if it does, we log a warning and show a generic notification
        console.warn("Push message without data", event);
        return worker.registration.showNotification("Huh?");
    }

    const args = pushDataToNotificationOptions(data);
    args[1].data = data; // Store the data in the notification for later use

    event.waitUntil(
        isClientFocused().then((clientIsFocused) => {
            // If the client is focused, we don't need to show a notification
            if (clientIsFocused) {
                console.debug("Client is focused, not showing notification.");
                return;
            } else {
                return worker.registration.showNotification(...args);
            }
        })
    );
});

/** Handles notification clicks.
 * Called if the user clicks on a notification.
 */
worker.addEventListener("notificationclick", (event) => {
    const data = event.notification.data as PushData | null;
    const clickedNotification = event.notification;

    if (!data) {
        console.warn("Notification click without data", event);
        clickedNotification.close();
        return;
    }

    if (event.action == "open-folder") {
        event.waitUntil(openInboxFolder(data.path, data.hash));
    } else if (event.action == "open-inbox") {
        event.waitUntil(openUrl("/inbox"));
    } else {
        // If no action is specified, we just open the homepage
        event.waitUntil(openUrl("/"));
    }

    clickedNotification.close();
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
