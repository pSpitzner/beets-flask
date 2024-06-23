import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import ThemeProvider from "./theme";
import CircularProgress from "@mui/material/CircularProgress";
import "@/lib/fetch";
import { StatusContextProvider } from "./lib/socket";

// Create a new query client instance
export const queryClient = new QueryClient({});

// Create a new router instance
const router = createRouter({
    routeTree,
    context: {
        queryClient,
    },
    defaultPreload: "intent",
    defaultPendingComponent: () => (
        <div className="flex flex-col h-screen w-screen justify-center items-center">
            <div className="flex flex-col space-y-4 justify-center items-center">
                <CircularProgress />
                <p className="text-lg">
                    Hang tight! We&apos;re tuning our server to tag your tunes.
                </p>
            </div>
        </div>
    ),

    // Since we're using React Query, we don't want loader calls to ever be stale
    // This will ensure that the loader is always called when the route is preloaded or visited
    defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <StatusContextProvider client={queryClient}>
                <ThemeProvider>
                    <RouterProvider router={router} />
                </ThemeProvider>
            </StatusContextProvider>
        </QueryClientProvider>
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
