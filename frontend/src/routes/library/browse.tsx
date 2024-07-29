import { useMemo } from "react";
import { Paper } from "@mui/material";
import Box from "@mui/material/Box";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { artistsQueryOptions, LIB_BROWSE_ROUTE } from "@/components/common/_query";
import { BrowserHeader } from "@/components/library/browserHeader";
import List from "@/components/library/list";

import styles from "@/components/library/library.module.scss";

export const Route = createFileRoute(LIB_BROWSE_ROUTE)({
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
            to: `${LIB_BROWSE_ROUTE}/$artist`,
            params: { artist: artist.name },
            label: artist.name,
            className: styles.listItem,
            "data-selected": params.artist && params.artist == artist.name,
        }));
    }, [artists, params]);

    console.log("browse ", artists, data);

    // for mobile, we only want to show one central column.
    const isSecondary = Boolean(params.artist);

    return (
        <>
            <Box className={styles.columnBrowser}>
                <Paper
                    className={`${styles.column} ${isSecondary ? styles.isSecondary : ""}`}
                >
                    <Box className={styles.columnLabel}>Artist</Box>
                    <BrowserHeader className={styles.browserHeader} />
                    <Box className={styles.listBox}>
                        <List data={data}>{List.Item}</List>
                    </Box>
                </Paper>
                <Outlet />
            </Box>
        </>
    );
}
