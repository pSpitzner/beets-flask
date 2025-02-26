import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import Box from "@mui/material/Box";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { customizeFetch, queryClient } from "@/components/common/_query";
import { PrefetchConfigQueryClientProvider } from "@/components/common/hooks/useConfig";
import { StatusContextProvider } from "@/components/common/hooks/useSocket";

import ThemeProvider from "./theme";

import { routeTree } from "./routeTree.gen";
import { Loading } from "./components/common/loading";
import { ErrorCard } from "./errors";

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

    // Error handling
    defaultErrorComponent: ({ error }) => (
        <Box
            sx={{
                display: "flex",
                width: "100%",
                height: "100%",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <ErrorCard error={error} />
        </Box>
    ),
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

function App() {
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
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const rootElement = document.getElementById("app")!;
if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <StrictMode>
            <App />
        </StrictMode>
    );
}
