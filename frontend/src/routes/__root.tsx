import {
    createRootRouteWithContext,
    Outlet,
    useRouterState,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

import "../index.css";

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    component: RootComponent,
});

function RootComponent() {
    return (
        <main className="flex flex-col h-screen w-screen">
            <RouteTransition />
            <Outlet />
            <TanStackRouterDevtools position="bottom-right" />
        </main>
    );
}

/**
 * We can change that for a more fun transition if we want
 * later on.
 *
 * @returns The spinner component.
 */
function RouteTransition() {
    const isLoading = useRouterState({ select: (s) => s.status === "pending" });
    return <>{isLoading ? "loading" : null}</>;
}
