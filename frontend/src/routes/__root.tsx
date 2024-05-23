import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Theme } from "@radix-ui/themes";

import "../index.css";
import "@radix-ui/themes/styles.css";

export const Route = createRootRoute({
    component: () => (
        <>
            <Theme
                appearance="dark"
                panelBackground="translucent"
                hasBackground={false}
                grayColor="mauve"
                radius="full"
                accentColor="mint"
            >
                <Outlet />
                <TanStackRouterDevtools position="bottom-right" />
            </Theme>
        </>
    ),
});
