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
                Mobile player:
                <MobilePlayer />
                Dekstop player:
                <DesktopPlayer />
            </PageWrapper>
            <audio
                controls
                src="http://localhost:5173/api_v1/library/item/4101/audio"
            />
        </AudioContextProvider>
    );
}
