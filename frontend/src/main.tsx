import { ReactNode, StrictMode, useEffect } from "react";
import ReactDOM from "react-dom/client";
import Box from "@mui/material/Box";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { customizeFetch, queryClient } from "@/api/common";
import { configQueryOptions } from "@/api/config";
import { Loading } from "@/components/common/loading";
import { StatusContextProvider } from "@/components/common/websocket/status";

import { PageWrapper } from "./components/common/page";
import { ErrorCard } from "./errors";
import ThemeProvider from "./theme";

import { routeTree } from "./routeTree.gen";

// we tweak the backend-route on the dev server
customizeFetch();

// Create a new router instance
const router = createRouter({
    routeTree,
    context: {
        queryClient,
    },

    // Default settings for the loader
    // i.e. show a loading spinner for at least 1 second
    defaultPendingComponent: () => (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                margin: "auto",
                maxWidth: "120px",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <Loading noteColor="#7FFFD4" />
            <Box component="span" style={{ marginTop: "1rem" }}>
                Loading...
            </Box>
        </Box>
    ),
    defaultPendingMinMs: 1000,

    defaultPreload: "intent",
    // Since we're using React Query, we don't want loader calls to ever be stale
    // This will ensure that the loader is always called when the route is preloaded or visited
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,

    // Error handling
    defaultErrorComponent: ({ error }) => (
        <PageWrapper
            sx={(theme) => ({
                height: "100%",
                display: "flex",
                [theme.breakpoints.up("tablet")]: {
                    p: 1,
                },
            })}
        >
            <Box
                sx={{
                    my: "auto",
                    width: "100%",
                }}
            >
                <ErrorCard error={error} />
            </Box>
        </PageWrapper>
    ),
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
export function PrefetchConfigQueryClientProvider({
    client,
    children,
}: {
    client: QueryClient;
    children: ReactNode;
}) {
    useEffect(() => {
        client.prefetchQuery(configQueryOptions()).catch(console.error);
    }, [client]);

    return (
        <QueryClientProvider client={client}>
            {" "}
            <ReactQueryDevtools initialIsOpen={false} />
            {children}
        </QueryClientProvider>
    );
}

export function App() {
    return (
        <PrefetchConfigQueryClientProvider client={queryClient}>
            <StatusContextProvider client={queryClient}>
                <ThemeProvider>
                    <RouterProvider router={router} />
                </ThemeProvider>
            </StatusContextProvider>
        </PrefetchConfigQueryClientProvider>
    );
}

// Render the app

const rootElement = document.getElementById("app")!;
if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <StrictMode>
            <App />
        </StrictMode>
    );
}
