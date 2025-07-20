import { BellIcon, WebhookIcon } from "lucide-react";
import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";
import { SubscribeToPushNotifications } from "@/components/notifications/push";
import { WebHookList } from "@/components/notifications/webhooks";

export const Route = createFileRoute("/settings/notifications")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <PageWrapper sx={{ padding: "2rem" }}>
            <Typography
                variant="h3"
                component="h1"
                sx={{ marginBottom: 2, fontWeight: 500 }}
            >
                Notifications Settings
            </Typography>
            <Typography
                variant="body1"
                sx={{ marginBottom: 4, color: "text.secondary" }}
            >
                Configure how your self-hosted beets-flask instance can send
                notifications to external systems. This includes webhooks for real-time
                updates and push notifications for browser alerts.
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <WebhooksCard />
                <PushCard />
            </Box>
        </PageWrapper>
    );
}

function WebhooksCard() {
    const theme = useTheme();
    return (
        <Card sx={{ margin: "0 auto", width: "100%" }}>
            <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <WebhookIcon size={theme.iconSize.lg} />
                    <Typography
                        variant="h4"
                        component="h2"
                        sx={{ fontWeight: 500, marginBottom: 1, marginTop: 0.5 }}
                    >
                        Webhooks
                    </Typography>
                </Box>
                <Typography
                    variant="body2"
                    sx={{ marginBottom: "1rem", color: "text.secondary" }}
                >
                    Webhooks let your self-hosted beets-flask instance notify external
                    systems immediately when key events occur, like new tags or imported
                    items. Instead of polling, you can push structured data to your own
                    services or infrastructure in real time.
                </Typography>
                <WebHookList />
            </CardContent>
        </Card>
    );
}

function PushCard() {
    const theme = useTheme();
    return (
        <Card sx={{ margin: "0 auto", width: "100%" }}>
            <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <BellIcon size={theme.iconSize.lg} />
                    <Typography
                        variant="h4"
                        component="h2"
                        sx={{ fontWeight: 500, marginBottom: 1, marginTop: 0.5 }}
                    >
                        Push
                    </Typography>
                </Box>
                <Typography
                    variant="body2"
                    sx={{ marginBottom: "1rem", color: "text.secondary" }}
                >
                    Push notifications allow your self-hosted beets-flask instance to
                    send real-time alerts directly to your browser, keeping you updated
                    on important events like new imports or tag changes.
                </Typography>
                <SubscribeToPushNotifications />
            </CardContent>
        </Card>
    );
}
