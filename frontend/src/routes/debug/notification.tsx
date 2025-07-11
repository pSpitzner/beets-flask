import { MailCheckIcon, MailIcon } from "lucide-react";
import { Alert, Box, Button, useTheme } from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import {
    pushSubscriptionQueryOptions,
    subscribeMutationOptions,
    unsubscribeMutationOptions,
} from "@/api/notifications";
import { useNotificationPermission } from "@/components/notifcations/useNotificationPermission";

export const Route = createFileRoute("/debug/notification")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <Box sx={{ padding: "2rem", textAlign: "center" }}>
            <h1>Notification Test Page</h1>
            <p>
                This page is used to test the notification functionality of the
                application. Click the button below to request notification permissions
                and subscribe to notifications.
            </p>
            <SubscribeToNotificationsButton />
            <SetupPushNotifications />
        </Box>
    );
}

function SubscribeToNotificationsButton() {
    const theme = useTheme();
    const { permission } = useNotificationPermission();

    if (permission === "granted") {
        return (
            <Button
                variant="contained"
                disabled
                startIcon={<MailCheckIcon size={theme.iconSize.md} />}
            >
                Notifications are allowed!
            </Button>
        );
    }

    if (permission === "prompt") {
        return (
            <Button
                variant="contained"
                onClick={() => {
                    askPermission()
                        .then(() => {
                            console.log("Notification permission granted.");
                        })
                        .catch((error) => {
                            alert("Failed to subscribe to notifications: " + error);
                        });
                }}
                startIcon={<MailIcon size={theme.iconSize.md} />}
            >
                Request Notification Permission
            </Button>
        );
    }

    // denied
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
            }}
        >
            <Alert severity="error">
                You denied the notification permission. You might need to enable it in
                your browser to try again!
            </Alert>
            <Button
                variant="outlined"
                color="error"
                onClick={() => {
                    askPermission()
                        .then(() => {
                            console.log("Notification permission granted.");
                        })
                        .catch((error) => {
                            alert("Failed to subscribe to notifications: " + error);
                        });
                }}
            >
                Request Notification Permission
            </Button>
        </Box>
    );
}

function SetupPushNotifications() {
    const { data: subscription, error } = useQuery(pushSubscriptionQueryOptions);

    if (error) {
        return (
            <Alert severity="error">
                Failed to fetch push subscription: {error.message}
            </Alert>
        );
    }

    // Unsubscribe from push notifications
    if (subscription) {
        return <UnsubscribeButton />;
    }

    // Subscribe to push notifications
    return (
        <Box sx={{ textAlign: "center", marginTop: "1rem" }}>
            <Alert severity="info">
                You are not subscribed to push notifications. Click the button below to
                subscribe.
            </Alert>
            <SubscribeButton />
        </Box>
    );
}

function SubscribeButton() {
    // TODO: error handling
    const { mutate, isPending } = useMutation(subscribeMutationOptions);

    return (
        <Button variant="contained" onClick={() => mutate()} loading={isPending}>
            Subscribe to Notifications
        </Button>
    );
}

function UnsubscribeButton() {
    // TODO: error handling
    const { mutate, isPending } = useMutation(unsubscribeMutationOptions);

    return (
        <Button variant="outlined" onClick={() => mutate()} loading={isPending}>
            Unsubscribe from Notifications
        </Button>
    );
}

function askPermission() {
    return new Promise(function (resolve, reject) {
        const permissionResult = Notification.requestPermission(function (result) {
            resolve(result);
        });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        if (permissionResult) {
            permissionResult.then(resolve, reject);
        }
    }).then(function (permissionResult) {
        if (permissionResult !== "granted") {
            throw new Error("We weren't granted permission.");
        }
    });
}
