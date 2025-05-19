import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { albumQueryOptions } from "@/api/library";
import { Tracklist } from "@/components/library/album";

export const Route = createFileRoute("/library/(resources)/album/$albumId/")({
    component: RouteComponent,
});

/** The default route shows the tracklist of an album.
 *
 * See ./route.tsx for the navigation and album header
 */
function RouteComponent() {
    const params = Route.useParams();
    const { data: album } = useSuspenseQuery(
        albumQueryOptions(params.albumId, true, false)
    );

    return (
        <Tracklist
            items={album.items}
            sx={(theme) => ({
                flex: "1 1 auto",
            })}
        />
    );
}
