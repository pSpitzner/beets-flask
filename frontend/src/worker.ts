/** Service worker. injected with vite-pwa-plugin */
/// <reference lib="webworker" />

const worker: ServiceWorkerGlobalScope = self as unknown as ServiceWorkerGlobalScope;

interface PushDataTagged {
    type: "tagged";
    // A new folder was just tagged
    hash: string;
    path: string;

    best_match: number;

    title: string;
    artist: string;
}

interface PushDataImported {
    //TODO
    type: "imported";
    hash: string;
    path: string;
}

type PushData = PushDataTagged | PushDataImported;

worker.addEventListener("push", (event) => {
    const data: PushData | null = (event.data?.json() as PushData) ?? null;
    console.log("Received a push message", event, data);

    let title = "Huh?";
    const options: NotificationOptions & {
        actions?: {
            // See https://web.dev/articles/push-notifications-display-a-notification#actions_buttons
            // for more information on actions
            action: string;
            title: string;
            icon: string;
            type?: string; // Optional, but can be used to specify the type of action
        }[];
    } = {
        body: "You received a push message, but we don't know what to do with it.",
    };

    if (data) {
        switch (data.type) {
            case "tagged":
                title = `Tagged: ${data.title} by ${data.artist}`;
                options.body = `Folder: ${data.path} (Best match: ${data.best_match})`;
                options.tag = data.hash; // Use the hash as the tag for uniqueness
                options.icon = "/logo_flask.svg";
                options.actions = [
                    {
                        action: "open-folder",
                        title: "Review tagged folder",
                        icon: "/tag.svg",
                    },
                ];
                break;
            case "imported":
                //TODO
                break;
            default:
                console.warn("Unknown push data type", data);
        }
    } else {
        console.warn("Received push message without data", event);
    }

    options.data = data; // Store the data in the notification for later use
    event.waitUntil(
        isClientFocused().then((clientIsFocused) => {
            // If the client is focused, we don't need to show a notification
            if (clientIsFocused) {
                console.log("Client is focused, not showing notification.");
                return;
            } else {
                return worker.registration.showNotification(title, options);
            }
        })
    );
});

worker.addEventListener("notificationclick", (event) => {
    const data = event.notification.data as PushData | null;
    const clickedNotification = event.notification;

    if (!data) {
        console.warn("Notification click without data", event);
        clickedNotification.close();
        return;
    }

    if (event.action == "open-folder") {
        event.waitUntil(openFolder(data.path, data.hash));
    }
    if (event.action == "open-inbox") {
        event.waitUntil(openUrl("/inbox"));
    }

    clickedNotification.close();
});

/** Open the inbox details for a specific
 * folder path and hash in the browser.
 */
async function openFolder(path: string, hash: string) {
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
