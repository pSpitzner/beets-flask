import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/library/track/$trackId")({
    parseParams: (params) => ({
        trackId: z.number().int().parse(Number(params.trackId)),
    }),
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(
            trackQueryOptions(opts.params.trackId)
        ),
    component: () => <Library />,
});

function Library() {
    const params = Route.useParams();
    const tracks = useSuspenseQuery(trackQueryOptions(params.trackId));


    if (!tracks.data) {
        return null;
    }

    return <div>{JSON.stringify(tracks.data,undefined,4)}</div>;
}
