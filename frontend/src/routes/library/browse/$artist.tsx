import List from "@/components/common/list";
import { artistQueryOptions } from "@/lib/library";
import Box from "@mui/material/Box";
import { Outlet, createFileRoute, useParams } from "@tanstack/react-router";
import z from "zod";
import styles from "./browse.module.scss";

export const Route = createFileRoute("/library/browse/$artist")({
    parseParams: (params) => ({
        artist: z.string().parse(params.artist),
    }),
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(
            artistQueryOptions({name: opts.params.artist, minimal: true, expand: true})
        ),
    component: ArtistOverview,
});

/** Shows all
 * albums of an artist
 */
function ArtistOverview() {
    const artist = Route.useLoaderData();

    const params = useParams({});
    const selectedAlbumId = params.albumId;

    return (
        <>
            <Box className={styles.listBox}>
                <List>
                    {artist.albums.map((album, i) => {
                        return (
                            <List.Item
                                key={i}
                                to={album.id.toString()}
                                label={album.name}
                                className={styles.listItem}
                                data-selected={album.id === selectedAlbumId}
                            />
                        );
                    })}
                </List>
            </Box>
            <Outlet />
        </>
    );
}
