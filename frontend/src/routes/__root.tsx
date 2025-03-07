import Box from "@mui/material/Box";
import { QueryClient } from "@tanstack/react-query";
import { HeadContent } from "@tanstack/react-router";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { TerminalContextProvider } from "@/components/frontpage/terminal";
import NavBar from "@/components/frontpage/navbar";

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

                        // if we want to move Navbar bottom
                        // marginTop: { xs: 0, md: "64px" },
                        overflow: "auto",
                    })}
                >
                    <Box sx={{ height: "100%" }}>
                        <TerminalContextProvider>
                            <Outlet />
                        </TerminalContextProvider>
                    </Box>
                </Box>
            </main>
        </>
    );
}
