import Container from "@mui/material/Container";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import NavTabs from "@/components/frontpage/navigationTabs";
import { Terminal, TerminalContextProvider } from "@/components/frontpage/terminal";

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
