import {
    BellIcon,
    BellOffIcon,
    BellPlusIcon,
    CheckIcon,
    SettingsIcon,
} from "lucide-react";
import { ReactNode, useState } from "react";
import {
    Alert,
    AlertTitle,
    Box,
    Button,
    DialogContent,
    Link,
    Typography,
    useTheme,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";

import { APIError } from "@/api/common";
import {
    pushQueryOptions,
    PushSubscriptionError,
    PushSubscriptionReturn,
    subscribePushMutationOptions,
    unsubscribePushMutationOptions,
    updatePushMutationOptions,
} from "@/api/notifications";
import { SubscriptionSettings } from "@/pythonTypes";

import { NotificationsSettings } from "./settings";
import { useNotificationPermission } from "./useNotificationPermission";

import { Dialog } from "../common/dialogs";

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
export function SubscribeToPushNotifications() {
    const theme = useTheme();
    const { permission, available, requestPermission } = useNotificationPermission();
    const { data: subscription, error: subscriptionError } = useQuery(pushQueryOptions);

    const alerts: Array<ReactNode> = [];

    if (!available) {
        alerts.push(
            <Alert severity="warning" key="notification-api-not-available">
                <AlertTitle>Notification API not available</AlertTitle>
                Notifications are not available in this browser. Please use a modern
                browser that supports the Notifications API. You might need to host this
                application on a secure context (HTTPS or use localhost).
            </Alert>
        );
    }

    if (subscriptionError) {
        if (subscriptionError instanceof PushSubscriptionError) {
            alerts.push(
                <Alert severity="warning" key="push-api-not-available">
                    <AlertTitle>Push API not available</AlertTitle>
                    {subscriptionError.message}
                </Alert>
            );
        } else if (
            subscriptionError instanceof APIError &&
            subscriptionError.statusCode !== 404 // 404 is expected if the subscription does not exist on the server
        ) {
            alerts.push(
                <Alert severity="error" key="fetch-subscription-error">
                    <AlertTitle>Failed to fetch subscription</AlertTitle>
                    {subscriptionError.message}
                </Alert>
            );
        }
    }
    if (permission === "denied") {
        alerts.push(
            <Alert severity="error" key="notification-permission-denied">
                <AlertTitle>Notification permission denied</AlertTitle>
                You have denied permission to receive notifications. You may need to
                change this in your browser settings manually if you want to receive
                notifications.
                <ul>
                    <Link
                        href="https://support.google.com/chrome/answer/3220216"
                        target="_blank"
                    >
                        <li>Chrome instructions</li>
                    </Link>
                    <Link
                        href="https://support.mozilla.org/en-US/kb/push-notifications-firefox"
                        target="_blank"
                    >
                        <li>Firefox instructions</li>
                    </Link>
                </ul>
            </Alert>
        );
    }

    // Return early if there are any alerts to show (only error or warning alerts)
    if (alerts.length > 0) {
        return (
            <Box
                sx={{
                    gap: 1,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {alerts}
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
            {permission === "granted" && !subscription && (
                <Alert severity="success" icon={<CheckIcon size={theme.iconSize.md} />}>
                    <AlertTitle>Notification permissions granted</AlertTitle>
                    You have granted permission to receive notifications.
                </Alert>
            )}

            {permission === "granted" && !subscription && (
                <Alert severity="warning">
                    <AlertTitle>Not subscribed to push service</AlertTitle>
                    You are not subscribed to the push service. You will not receive
                    updates from the server. Click the button below to subscribe!
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
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            width: "100%",
                            gap: 1,
                        }}
                    >
                        <UnsubscribeButton />
                        <PushSettings subscription={subscription} />
                    </Box>
                )}
            </Box>
        </Box>
    );
}

function UnsubscribeButton() {
    const theme = useTheme();
    const { mutate, isPending } = useMutation(unsubscribePushMutationOptions);
    // TODO: error handling

    return (
        <Button
            variant="outlined"
            onClick={() => mutate()}
            loading={isPending}
            color="error"
            startIcon={<BellOffIcon size={theme.iconSize.md} />}
        >
            Unsubscribe
        </Button>
    );
}

function RequestPermissionAndSubscribeButton({
    requestPermission,
}: {
    requestPermission?: () => Promise<void>;
}) {
    const theme = useTheme();
    const { mutate, isPending } = useMutation(subscribePushMutationOptions);
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
            startIcon={<BellPlusIcon size={theme.iconSize.md} />}
        >
            Subscribe
        </Button>
    );
}

function PushSettings({ subscription }: { subscription: PushSubscriptionReturn }) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    const { mutateAsync: updatePush } = useMutation(updatePushMutationOptions);

    const [subSettingsCopy, setSubSettingsCopy] = useState<SubscriptionSettings>(
        subscription.server.settings
    );

    return (
        <>
            <Button
                variant="contained"
                component={Link}
                startIcon={<SettingsIcon size={theme.iconSize.md} />}
                onClick={() => setOpen(true)}
            >
                Settings
            </Button>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                title_icon={<BellIcon size={theme.iconSize.lg} />}
                title="Configure Push Notifications"
            >
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Configure your push notification settings below. These settings
                        will be applied to your current device subscription only.
                    </Typography>
                    <NotificationsSettings
                        settings={subSettingsCopy}
                        setSettings={setSubSettingsCopy}
                    />

                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                            marginTop: 2,
                            justifyContent: "space-between",
                        }}
                    >
                        <Button
                            variant="text"
                            onClick={() => {
                                alert(
                                    "This feature is not implemented yet. Please check the console for more information."
                                );
                            }}
                        >
                            Test
                        </Button>
                        <Button
                            variant="contained"
                            onClick={async () => {
                                await updatePush(subSettingsCopy);
                                setOpen(false);
                            }}
                        >
                            Save
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    );
}
