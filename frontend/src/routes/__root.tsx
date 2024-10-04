import Box from "@mui/material/Box";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import NavTabs from "@/components/frontpage/navbar";
import { TerminalContextProvider } from "@/components/frontpage/terminal";

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    component: RootComponent,
});

function RootComponent() {
    return (
        <main style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
            <Box
                className="DefaultBlurBg"
                sx={{
                    position: "fixed",
                    top: 0,
                    zIndex: 1000,
                    width: "100dvw",
                    height: "48px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
                <NavTabs />
            </Box>
            <Box
                id="main-content"
                sx={{
                    flexGrow: 1,
                    paddingTop: "48px",
                    // position: "relative",
                    // top: "64px",
                    // if we want to move Navbar bottom
                    // marginTop: { xs: 0, md: "64px" },
                }}
            >
                <TerminalContextProvider>
                    <Outlet />
                </TerminalContextProvider>
            </Box>
        </main>
    );
}
