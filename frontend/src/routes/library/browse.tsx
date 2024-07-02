import { artistsQueryOptions } from "@/lib/library";
import { Outlet, createFileRoute, useParams } from "@tanstack/react-router";

import List from "@/components/common/list";
import Box from "@mui/material/Box";
import styles from "./browse.module.scss";
import { useMemo } from "react";

export const Route = createFileRoute("/library/browse")({
    loader: (opts) => opts.context.queryClient.ensureQueryData(artistsQueryOptions()),
    component: () => <AllArtists />,
});

function AllArtists() {
    const artists = Route.useLoaderData();

    const params = useParams({ strict: false }) as { artist?: string };
    const data = useMemo(() => {
        return artists.map((artist) => ({
            to: artist.name,
            label: artist.name,
            className: styles.listItem,
            "data-selected": params.artist == artist.name,
        }));
    }, [artists, params]);

    return (
        <>
            <Box className={styles.columnBrowser}>
                <Box className={styles.listBox}>
                    <List data={data}>{List.Item}</List>
                </Box>
                <Outlet />
            </Box>
        </>
    );
}
