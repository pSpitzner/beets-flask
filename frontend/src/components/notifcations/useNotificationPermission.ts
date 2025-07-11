import { useCallback, useEffect, useState } from "react";

export function useNotificationPermission() {
    const [available, setAvailable] = useState(true);
    const [permission, setPermission] = useState<PermissionState>("prompt");

    useEffect(() => {
        // Check if the Notifications API is available
        if (!("Notification" in window)) {
            setAvailable(false);
            return;
        }
        const isSecureContext = window.isSecureContext;
        if (!isSecureContext) {
            console.log("Notifications are blocked: Must use HTTPS (or localhost).");
            setAvailable(false);
            return;
        }
    }, []);

    useEffect(() => {
        if (!("navigator" in window)) return;

        const abortController = new AbortController();

        navigator.permissions
            .query({ name: "notifications" })
            .then((result) => {
                setPermission(result.state);

                // Listen for permission changes
                result.addEventListener(
                    "change",
                    () => {
                        setPermission(result.state);
                    },
                    { signal: abortController.signal }
                );
            })
            .catch((error) => {
                console.error("Failed to query notification permissions:", error);
                setPermission("denied");
            });

        return () => {
            // Cleanup the event listener
            abortController.abort();
        };
    }, []);

    const requestPermission = useCallback(async () => {
        if (!available) {
            throw new Error("Notifications are not available in this browser.");
        }

        const permissionResult = await Notification.requestPermission();

        if (permissionResult !== "granted") {
            throw new Error("Notification permission was not granted.");
        }

        setPermission(permissionResult);
    }, [available]);

    return {
        available,
        permission,
        requestPermission,
    };
}
