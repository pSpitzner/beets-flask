import { Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { itemQueryOptions } from "@/api/library";
import { PageWrapper } from "@/components/common/page";
import {
    AudioContextProvider,
    useAudioContext,
} from "@/components/library/audio/context";
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
                        alignItems: "center",
                        border: "1px solid",
                        flexDirection: "column",
                        p: 1,
                        mb: "auto",
                    })}
                >
                    <AddButton />
                    <MobilePlayer />
                </Box>
                <DesktopPlayer />
            </PageWrapper>
        </AudioContextProvider>
    );
}

function AddButton() {
    const { addToQueue } = useAudioContext();
    const { data: item } = useQuery(itemQueryOptions(4101, false));

    return (
        <button
            onClick={() => {
                if (!item) {
                    console.error("Item is undefined");
                    return;
                }
                addToQueue(item);
            }}
        >
            Add
        </button>
    );
}
