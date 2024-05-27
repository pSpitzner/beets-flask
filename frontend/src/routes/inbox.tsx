import { createFileRoute } from "@tanstack/react-router";

import {
    useQuery,
    useMutation,
    useQueryClient,
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient();

export const Route = createFileRoute("/inbox")({
    component: () => (
        <QueryClientProvider client={queryClient}>
            <Inbox />
        </QueryClientProvider>
    ),
});

export function Inbox() {
    const QueryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["inbox"],
        queryFn: async () => {
            const response = await fetch("/api_v1/inbox");
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        },
    });

    console.log(query.data);

    return (
        <div>
            <h1>Inbox Overview</h1>
            <p>TODO: Implement this page</p>
        </div>
    );
}
