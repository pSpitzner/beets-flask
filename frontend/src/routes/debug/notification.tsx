import { MailCheckIcon, MailIcon, MailXIcon } from "lucide-react";
import { Alert, AlertTitle, Box, Button, useTheme } from "@mui/material";
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
        <Box sx={{ padding: "2rem" }}>
            <h1>Notification Test Page</h1>
            <p>
                This page is used to test the notification functionality of the
                application. Click the button below to request notification permissions
                and subscribe to notifications.
            </p>
            <SubscribeToNotifications />
        </Box>
    );
}

/** This component handles the subscription to notifications.
 *
 * We try to keep it simple and only show one button at a time to the user.
 *
 * Notifications consist of two parts,
 * 1. The browser's Notification API, which allows us to show notifications to the user.
 * 2. The Push API, which allows us to send notifications from the server to the browser.
 *
 * The browser needs to support both APIs, and the user needs to grant permission.
 */
function SubscribeToNotifications() {
    const theme = useTheme();
    const { permission, available, requestPermission } = useNotificationPermission();
    const { data: subscription, error: subscriptionError } = useQuery(
        pushSubscriptionQueryOptions
    );

    if (!available || subscriptionError) {
        return (
            <Box
                sx={{
                    gap: 1,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {!available && (
                    <Alert severity="warning">
                        <AlertTitle>Notification API not available</AlertTitle>
                        Notifications are not available in this browser. Please use a
                        modern browser that supports the Notifications API. You might
                        need to host this application on a secure context (HTTPS or use
                        localhost).
                    </Alert>
                )}
                {subscriptionError && (
                    <Alert severity="warning">
                        <AlertTitle>Push API not available</AlertTitle>
                        {subscriptionError.message}
                    </Alert>
                )}
            </Box>
        );
    }

    return (
        <Box
            sx={{
                gap: 1,
                display: "flex",
                flexDirection: "column",
            }}
        >
            {permission === "granted" && (
                <Alert
                    severity="success"
                    icon={<MailCheckIcon size={theme.iconSize.md} />}
                >
                    <AlertTitle>Notification permissions granted</AlertTitle>
                    You have granted permission to receive notifications.
                </Alert>
            )}
            {permission === "denied" && (
                <Alert severity="error" icon={<MailXIcon size={theme.iconSize.md} />}>
                    <AlertTitle>Notification permissions denied</AlertTitle>
                    You have denied permission to receive notifications. You may need to
                    change this in your browser settings manually!
                </Alert>
            )}
            {permission === "granted" && !subscription && (
                <Alert severity="warning">
                    <AlertTitle>Not subscribed to push notifications</AlertTitle>
                    You are not subscribed to push notifications. You will not receive
                    updates from the server.
                </Alert>
            )}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 1,
                }}
            >
                {permission === "prompt" || !subscription ? (
                    <RequestPermissionAndSubscribeButton
                        requestPermission={requestPermission}
                    />
                ) : (
                    <UnsubscribeButton />
                )}
            </Box>
        </Box>
    );
}

function RequestPermissionAndSubscribeButton({
    requestPermission,
}: {
    requestPermission?: () => Promise<void>;
}) {
    const theme = useTheme();
    const { mutate, isPending } = useMutation(subscribeMutationOptions);
    // TODO: error handling

    return (
        <Button
            variant="contained"
            color="primary"
            onClick={async () => {
                try {
                    await requestPermission?.();
                    mutate();
                } catch (error) {
                    alert("Failed to subscribe to notifications: " + error);
                }
            }}
            loading={isPending}
            startIcon={<MailIcon size={theme.iconSize.md} />}
        >
            Subscribe
        </Button>
    );
}

function UnsubscribeButton() {
    const theme = useTheme();
    const { mutate, isPending } = useMutation(unsubscribeMutationOptions);
    // TODO: error handling

    return (
        <Button
            variant="outlined"
            onClick={() => mutate()}
            loading={isPending}
            color="error"
            startIcon={<MailXIcon size={theme.iconSize.md} />}
        >
            Unsubscribe
        </Button>
    );
}
