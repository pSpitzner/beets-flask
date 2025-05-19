import { createFileRoute } from "@tanstack/react-router";

import { JSONPretty } from "@/components/common/json";

export const Route = createFileRoute("/library/(resources)/item/$itemId")({
    parseParams: (params) => {
        const itemId = parseInt(params.itemId);
        if (isNaN(itemId)) {
            throw new Error(`Invalid itemId: ${params.itemId}`);
        }
        return { itemId };
    },
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    return (
        <div>
            <JSONPretty data={params} style={{ padding: "1rem" }}></JSONPretty>
        </div>
    );
}
