import { artistsQueryOptions } from "@/lib/library";
import { Outlet, createFileRoute } from "@tanstack/react-router";

import List from "@/components/common/list";
import Box from "@mui/material/Box";
import styles from "./browse.module.scss";
import { useMemo } from "react";
import { Paper } from "@mui/material";

export const BASE_ROUTE = "/library/browse";
export const Route = createFileRoute(BASE_ROUTE)({
    loader: (opts) => opts.context.queryClient.ensureQueryData(artistsQueryOptions()),
    component: () => <AllArtists />,
});

interface RouteParams {
    artist?: string;
}

function AllArtists() {
    const artists = Route.useLoaderData();
    const params = Route.useParams<RouteParams>();

    const data = useMemo(() => {
        return artists.map((artist) => ({
            to: `${BASE_ROUTE}/$artist`,
            params: { artist: artist.name },
            label: artist.name,
            className: styles.listItem,
            "data-selected": params.artist && params.artist == artist.name,
        }));
    }, [artists, params]);

    // for mobile, we only want to show one central column.
    const isSecondary = Boolean(params.artist);

    return (
        <>
            <Box className={styles.columnBrowser}>
                <Paper
                    className={`${styles.listBox} ${isSecondary ? styles.isSecondary : ""}`}
                >
                    <List data={data}>{List.Item}</List>
                </Paper>
                <Outlet />
            </Box>
        </>
    );
}
