import { Box } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";
import { AudioContextProvider } from "@/components/library/audio/context";
import { DesktopPlayer, MobilePlayer } from "@/components/library/audio/player";

export const Route = createFileRoute("/debug/audio")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <AudioContextProvider>
            <PageWrapper
                sx={{
                    height: "100%",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    flexDirection: "column",
                }}
            >
                <Box
                    sx={(theme) => ({
                        maxWidth: theme.breakpoints.values.tablet,
                        width: "100%",
                        display: "flex",
                        justifyContent: "flex-end",
                        aspectRatio: "9/16",
                        alignItems: "flex-end",
                        border: "1px solid",
                        p: 1,
                        mb: "auto",
                    })}
                >
                    <MobilePlayer />
                </Box>
                <DesktopPlayer />
            </PageWrapper>
        </AudioContextProvider>
    );
}
