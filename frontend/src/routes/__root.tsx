import Container from "@mui/material/Container";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import NavTabs from "@/components/frontpage/navbar";
import { TerminalContextProvider } from "@/components/frontpage/terminal";
import ToolBar from "@/components/frontpage/toolbar";

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    component: RootComponent,
});

function RootComponent() {
    return (
        <main>
            <TerminalContextProvider>
                <NavTabs />
                <Container
                    maxWidth="lg"
                    sx={{
                        mt: 1,
                        px: { xs: 1 },
                        flexGrow: 1,
                        overflow: "hidden",
                        // display: "flex",
                        // flexDirection: "column",
                    }}
                >
                    <Outlet />
                </Container>
                <ToolBar />
            </TerminalContextProvider>
        </main>
    );
}
