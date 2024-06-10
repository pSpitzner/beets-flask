import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import "../index.css";
import NavTabs from "@/components/common/navigation/tabs";
import Container from "@mui/material/Container";
import { Terminal } from "@/components/terminal";

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    component: RootComponent,
});

function RootComponent() {
    return (
        <main className="flex flex-col w-screen">
            <NavTabs />
            <Container maxWidth="lg" className="mt-2">
                <Outlet />
            </Container>
            <Terminal />
        </main>
    );
}
