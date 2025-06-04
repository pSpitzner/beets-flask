import { useMemo } from "react";
import { Box } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { itemQueryOptions } from "@/api/library";
import {
    PropertyValueTable,
    Serializable,
} from "@/components/common/propertyValueTable";

export const Route = createFileRoute("/library/(resources)/item/$itemId/beetsdata")({
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();
    const { data: item } = useSuspenseQuery(itemQueryOptions(params.itemId, false));

    // Create a flat list of all the properties without sources
    const itemNoSources = useMemo(() => {
        const n = structuredClone(item) as Record<string, Serializable>;
        delete n.sources;
        return n;
    }, [item]);

    return (
        <Box
            sx={{
                overflow: "auto",
                height: "100%",
            }}
        >
            <PropertyValueTable
                data={itemNoSources}
                sx={{
                    overflow: "hidden",
                    thead: {
                        th: {
                            backgroundColor: "background.paper",
                        },
                    },
                }}
            />
        </Box>
    );
}
