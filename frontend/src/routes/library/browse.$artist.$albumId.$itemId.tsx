import Box from "@mui/material/Box";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { itemQueryOptions } from "@/api/library";
import { Item } from "@/components/library/itemold";

import { Content } from "./browse";

export const Route = createFileRoute(`/library/browse/$artist/$albumId/$itemId`)({
    parseParams: (params) => ({
        itemId: parseInt(params.itemId),
    }),
    loader: async (opts) =>
        await opts.context.queryClient.ensureQueryData(
            itemQueryOptions(opts.params.itemId, false)
        ),
    component: ItemPage,
});

/** Shows a singular item */
function ItemPage() {
    const params = Route.useParams();
    const { data } = useSuspenseQuery(itemQueryOptions(params.itemId, false));

    return (
        <Content>
            <Box sx={{ width: "100%", height: "100%", overflow: "auto" }}>
                <Item item={data} />
            </Box>
        </Content>
    );
}
