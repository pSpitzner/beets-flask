import z from "zod";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { createFileRoute } from "@tanstack/react-router";

import { itemQueryOptions, LIB_BROWSE_ROUTE } from "@/components/common/_query";
import { BrowserHeader } from "@/components/library/browserHeader";
import { ItemView } from "@/components/library/itemAlbumDetails";

import styles from "@/components/library/library.module.scss";

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
            <Paper className={styles.column}>
                <Box className={styles.columnLabel}>Info</Box>
                <BrowserHeader
                    className={styles.browserHeader + " " + styles.alwaysShow}
                />
                <ItemView itemId={params.itemId} />
            </Paper>
        </>
    );
}
