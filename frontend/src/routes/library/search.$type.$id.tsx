import { z } from "zod";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { createFileRoute } from "@tanstack/react-router";

import { SearchType } from "@/components/common/useSearch";
import { TrackView } from "@/components/library/trackView";

import { RouteParams } from "./search";

import styles from "@/components/library/library.module.scss";

export const Route = createFileRoute("/library/search/$type/$id")({
    parseParams: (params) => ({
        id: z.number().int().parse(parseInt(params.id)),
        type: z.string().parse(params.type) as SearchType,
    }),
    component: ItemView,
});

function ItemView() {
    const params = Route.useParams<RouteParams>();

    return (
        <>
            <Paper className={styles.SearchResultInfoOuter}>
                <Box className={styles.SearchResultInfo}>
                    <TrackView itemId={params.id} />
                </Box>
            </Paper>
        </>
    );
}
