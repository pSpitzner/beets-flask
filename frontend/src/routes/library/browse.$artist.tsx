import { Disc3Icon } from "lucide-react";
import { useMemo } from "react";
import { Typography, useMediaQuery } from "@mui/material";
import {
    createFileRoute,
    Link,
    Outlet,
    useMatch,
    useParams,
} from "@tanstack/react-router";

import { albumsByArtistQueryOptions } from "@/api/library";

import { LibraryList, Selection } from "./browse";

import styles from "./library.module.scss";

export const Route = createFileRoute(`/library/browse/$artist`)({
    loader: async (opts) =>
        await opts.context.queryClient.ensureQueryData(
            albumsByArtistQueryOptions(
                opts.params.artist,
                false, //expand
                true //minimal
            )
        ),
    component: AlbumsRoute,
});

function AlbumsRoute() {
    return (
        <>
            <Selection sx={{ gridColumn: "albums" }}>
                <Albums />
            </Selection>
            <Outlet />
        </>
    );
}

/** A list of all albums (for the current artist).
 *
 * On mobile if an album is selected the
 * current album is shown as a breadcrumb instead.
 */
function Albums() {
    const albums = Route.useLoaderData();
    const params = useParams({ strict: false });
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down("laptop"));

    // Allow to deselect the album
    const match = useMatch({
        from: `/library/browse/$artist/$albumId`,
        shouldThrow: false,
    });
    const to = match ? `/library/browse/$artist` : `/library/browse/$artist/$albumId`;

    const data = useMemo(() => {
        return albums.map((album) => ({
            to:
                params.albumId == album.id
                    ? `/library/browse/$artist`
                    : `/library/browse/$artist/$albumId`,
            params: { artist: params.artist, albumId: album.id },
            label: album.name,
            className: styles.item,
            "data-selected": params.albumId && params.albumId == album.id,
        }));
    }, [albums, params, to]);

    const selectedData = data.find((item) => item["data-selected"] === true);

    if (isMobile && selectedData) {
        return (
            <Link
                to={selectedData.to}
                params={selectedData.params}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    paddingInline: 4,
                }}
            >
                <Disc3Icon size={18} color={"gray"} />
                <Typography variant="body2" color="text.secondary">
                    {selectedData.label}
                </Typography>
            </Link>
        );
    }

    return (
        <LibraryList
            data={data}
            selected={selectedData}
            label="Albums"
            labelIcon={<Disc3Icon />}
        />
    );
}
