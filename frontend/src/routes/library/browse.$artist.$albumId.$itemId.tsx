import z from "zod";
import Box from "@mui/material/Box";
import { createFileRoute } from "@tanstack/react-router";

import { itemQueryOptions, LIB_BROWSE_ROUTE } from "@/components/common/_query";

import { Content } from "./browse";

import styles from "./library.module.scss";
import { useState } from "react";

export const Route = createFileRoute(`${LIB_BROWSE_ROUTE}/$artist/$albumId/$itemId`)({
    parseParams: (params) => ({
        itemId: z.number().int().parse(parseInt(params.itemId)),
    }),
    // PS 24-07-26: I kept the loader, although the new TrackView does query on its own. because it uses the same querykeys, i suppose pre-loading should still work.
    loader: async (opts) =>
        await opts.context.queryClient.ensureQueryData(
            itemQueryOptions({
                id: opts.params.itemId,
                minimal: false,
                expand: true,
            })
        ),
    component: ItemPage,
});

/** Shows a singular item */
function ItemPage() {
    const params = Route.useParams();
    return (
        <Content>
            <Box sx={{ width: "100%", height: "100%", overflow: "auto" }}>
                <Box className={styles.label}>Info</Box>
                <ItemView />
            </Box>
        </Content>
    );
}

function ItemView() {
    const [showDetails, setShowDetails] = useState(false);
    const data = Route.useLoaderData();

    return (
        <>
            <Box></Box>
        </>
    );
}
