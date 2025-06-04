import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import Box from "@mui/material/Box";
import { QueryClient } from "@tanstack/react-query";
import { HeadContent } from "@tanstack/react-router";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { PageWrapper } from "@/components/common/page";
import NavBar from "@/components/frontpage/navbar";
import { TerminalContextProvider } from "@/components/frontpage/terminal";
import {
    AudioContextProvider,
    useAudioContext,
} from "@/components/library/audio/context";

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    component: RootComponent,
    head: () => ({
        meta: [
            {
                name: "description",
                content: "Opinionated web-interface around the music organizer beets.",
            },
            {
                title: "Beets",
            },
        ],
        links: [
            {
                rel: "icon",
                type: "image/png",
                href: "/logo.png",
            },
        ],
    }),
});

function RootComponent() {
    return (
        <>
            <HeadContent />
            <main
                style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100dvh",
                    overflow: "hidden",
                }}
            >
                <NavBar />
                <Box
                    id="main-content"
                    sx={(theme) => ({
                        flexGrow: 1,
                        [theme.breakpoints.up("laptop")]: {
                            paddingTop: "48px", // Navbar
                        },
                        [theme.breakpoints.down("laptop")]: {
                            position: "fixed",
                            bottom: "48px", // Navbar height
                            height: "calc(100dvh - 48px)", // Navbar height
                        },
                        width: "100%",
                        height: "100%",

                        // if we want to move Navbar bottom
                        // marginTop: { xs: 0, md: "64px" },
                        overflow: "auto",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                    })}
                >
                    <TerminalContextProvider>
                        <AudioContextProvider>
                            {/* A bit messy but needed for the audio player scroll */}
                            <Box sx={{ height: "100%", overflow: "hidden" }}>
                                <Box sx={{ height: "100%", overflow: "auto" }}>
                                    <Outlet />
                                </Box>
                                <LazyAudioPlayer />
                            </Box>
                        </AudioContextProvider>
                    </TerminalContextProvider>
                </Box>
            </main>
        </>
    );
}

/** We do not want to load the audio
 * player components if they are not used.
 *
 * The following allow us to lazy load the audio
 * player components.
 */
const AudioPlayer = lazy(() => import("@/components/library/audio/player"));

function LazyAudioPlayer() {
    const ref = useRef<HTMLDivElement>(null);
    const { items } = useAudioContext();
    const nItems = useMemo(() => items.length, [items]);

    useEffect(() => {
        if (nItems == 0 || !ref.current) return;
        const playerElem = ref.current;

        // Add padding the the pages to allow for scrolling
        const prevElement = playerElem.previousElementSibling as HTMLDivElement;
        const childPrevElement = prevElement?.firstElementChild as HTMLDivElement;

        const resizeObserver = new ResizeObserver((entries) => {
            const height = entries[0].borderBoxSize[0].blockSize;
            childPrevElement.style.paddingBottom = `${height}px`;
            childPrevElement.style.overflow = "auto";
        });
        resizeObserver.observe(playerElem);
        return () => {
            childPrevElement.style.paddingBottom = "0px";
            resizeObserver.unobserve(playerElem);
        };
    }, [nItems]);

    return (
        <Suspense fallback={<Box />}>
            <Box
                ref={ref}
                sx={{
                    position: "absolute",
                    bottom: 0,
                    width: "100%",
                    zIndex: 1,
                }}
            >
                <PageWrapper sx={{ padding: 1 }}>
                    <AudioPlayer />
                </PageWrapper>
            </Box>
        </Suspense>
    );
}
