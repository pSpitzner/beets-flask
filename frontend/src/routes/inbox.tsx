import { createFileRoute } from "@tanstack/react-router";

import { useSuspenseQuery } from "@tanstack/react-query";
import { inboxQueryOptions } from "../lib/queryOptions";

export const Route = createFileRoute("/inbox")({
    loader: (opts) => opts.context.queryClient.ensureQueryData(inboxQueryOptions()),
    component: () => <Inbox />,
});

export function Inbox() {
    const query = useSuspenseQuery(inboxQueryOptions());

    console.log(query.data);

    return (
        <div>
            <h1>Inbox Overview</h1>
            <p>TODO: Implement this page</p>
        </div>
    );
}
