import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import "../index.css";
import NavTabs from "@/components/common/navigation/tabs";
import Container from "@mui/material/Container";
import { Terminal, TerminalContextProvider } from "@/components/terminal";

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    component: RootComponent,
});

function RootComponent() {
    return (
        <main className="flex flex-col w-screen">
            <TerminalContextProvider>
                <NavTabs />
                <Container
                    maxWidth="lg"
                    sx={{
                        mt: 1,
                        px: { xs: 1 },
                    }}
                >
                    <Outlet />
                </Container>
                <Terminal />
            </TerminalContextProvider>
        </main>
    );
}
