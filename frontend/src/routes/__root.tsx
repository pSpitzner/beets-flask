import {
    createRootRouteWithContext,
    Outlet,
    useRouterState,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Theme } from "@radix-ui/themes";

import "../index.css";
import "@radix-ui/themes/styles.css";

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    component: RootComponent,
});

function RootComponent() {
    return (
        <>
            <Theme
                appearance="dark"
                panelBackground="translucent"
                hasBackground={false}
                grayColor="mauve"
                radius="full"
                accentColor="mint"
            >
                <RouteTransition />
                <Outlet />
                <TanStackRouterDevtools position="bottom-right" />
            </Theme>
        </>
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
