// Show an info box where the user is currently navigating

import { albumQueryOptions, itemQueryOptions } from "@/lib/library";
import { Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

interface BrowseHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    lorem?: string;
}

interface RouteParams {
    artist?: string;
    albumId?: number;
    itemId?: number;
}

export function BrowserHeader({ ...props }: BrowseHeaderProps) {
    const params: RouteParams = useParams({ strict: false });
    const artist = params.artist ?? "Artists"

    const { data : albumData} = useQuery(
        // although we do not need all the details, we use the same query options as for the browser to use the cache
        albumQueryOptions({
            id: params.albumId,
            expand: true,
            minimal: true,
        })
    );
    const album = albumData?.name;

    const { data : itemData } = useQuery(
            itemQueryOptions({
                id: params.itemId,
                minimal: false,
                expand: true,
            })
        );
    const track = itemData?.name;

    return (
        <div {...props}>
            <Typography
                sx={{
                    fontSize: "2rem",
                    fontWeight: "bold",
                }}
            >
                {artist}
            </Typography>
            <Typography
                sx={{
                    fontSize: "1.2rem",
                }}
            >
                {album}
            </Typography>
            <Typography
                sx={{
                    fontSize: "1.0rem",
                    fontStyle: "italic",
                }}
            >
                {track}
            </Typography>
        </div>
    );
}
