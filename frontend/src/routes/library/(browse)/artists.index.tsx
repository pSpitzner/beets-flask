import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { artistsQueryOptions } from "@/api/library";
import { JSONPretty } from "@/components/common/json";

export const Route = createFileRoute("/library/(browse)/artists/")({
    loader: async (opts) => {
        await opts.context.queryClient.ensureQueryData(artistsQueryOptions());
    },
    component: RouteComponent,
});

function RouteComponent() {
    const { data: artists } = useSuspenseQuery(artistsQueryOptions());
    return <JSONPretty data={artists} />;
}
