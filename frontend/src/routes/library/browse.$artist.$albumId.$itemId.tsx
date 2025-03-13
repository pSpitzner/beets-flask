import z from "zod";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { createFileRoute } from "@tanstack/react-router";

import { itemQueryOptions, LIB_BROWSE_ROUTE } from "@/components/common/_query";
import { BrowserHeader } from "@/components/library/browserHeader";
import { ItemView } from "@/components/library/itemAlbumDetails";

import { Content } from "./browse";

import styles from "./library.module.scss";

export const Route = createFileRoute(`${LIB_BROWSE_ROUTE}/$artist/$albumId/$itemId`)({
    parseParams: (params) => ({
        itemId: z.number().int().parse(parseInt(params.itemId)),
    }),
    // PS 24-07-26: I kept the loader, although the new TrackView does query on its own. because it uses the same querykeys, i suppose pre-loading should still work.
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(
            itemQueryOptions({
                id: opts.params.itemId,
                minimal: false,
                expand: true,
            })
        ),
    component: TrackPage,
});

function TrackPage() {
    const params = Route.useParams();
    return (
        <>
            <Content>
                <Box sx={{ width: "100%", height: "100%", overflow: "auto" }}>
                    <Box className={styles.label}>Info</Box>
                    <ItemView itemId={params.itemId} />
                </Box>
            </Content>
        </>
    );
}
