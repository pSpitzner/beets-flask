import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { itemQueryOptions } from "@/api/library";
import { Identifier } from "@/components/library/itemold";

export const Route = createFileRoute("/library/(resources)/item/$itemId/identifier")({
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    const { data: item } = useSuspenseQuery(itemQueryOptions(params.itemId, false));

    return <Identifier item={item} />;
}
