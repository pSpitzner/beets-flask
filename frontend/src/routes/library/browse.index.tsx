import { artistsQueryOptions } from "@/lib/library";
import { Outlet, createFileRoute, useParams } from "@tanstack/react-router";


import List from "@/components/common/list";
import Box from "@mui/material/Box";
import styles from "./browse.module.scss";

export const Route = createFileRoute("/library/browse/")({
    loader: (opts) => opts.context.queryClient.ensureQueryData(artistsQueryOptions()),
    component: () => <AllArtists />,
});

function AllArtists() {
    const artists = Route.useLoaderData();
    // TODO: @sm how to do this with tanstack? we want to grab a subpath that is set when clicking the link? it works but typescript complains
    const params = useParams({ from: "/library/browse/$artist/$albumId/$itemId" });
    const selectedArtistName = params.artist;

    return (
        <>
            <Box className={styles.columnBrowser}>
                <Box className={styles.listBox}>
                    <List>
                        {artists.map((artist, i) => {
                            return (
                                <List.Item
                                    key={i}
                                    to={artist.name}
                                    label={artist.name}
                                    className={styles.listItem}
                                    data-selected={artist.name === selectedArtistName}
                                />
                            );
                        })}
                    </List>
                </Box>
                <Outlet />
            </Box>
        </>
    );
}
