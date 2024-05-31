import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

import "../index.css";
import NavTabs from "@/components/common/navigation/tabs";
import Container from "@mui/material/Container";

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    component: RootComponent,
});

function RootComponent() {
    return (
        <main className="flex flex-col h-screen w-screen">
            <NavTabs />
            <Container maxWidth="lg" className="mt-2">
                <Outlet />
            </Container>
            <TanStackRouterDevtools position="bottom-right" />
        </main>
    );
}
