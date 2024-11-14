// Show an info box where the user is currently navigating

import { Box, Typography } from "@mui/material";
import { SxProps } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

import { albumQueryOptions, itemQueryOptions } from "@/components/common/_query";

import CoverArt from "./coverArt";

export function BrowserHeader({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
    const params: RouteParams = useParams({ strict: false });
    const artist = params.artist ?? "Artists";

    // although we do not need all the details, we use the same query options as for the browser to use the cache
    // if the parsed id is undefined, the queries return null without server communication
    const { data: albumData } = useQuery(
        albumQueryOptions({
            id: params.albumId,
            expand: true,
            minimal: true,
        })
    );
    const album = albumData?.name;

    const { data: itemData } = useQuery(
        itemQueryOptions({
            id: params.itemId,
            minimal: false,
            expand: true,
        })
    );
    const track = itemData?.name;

    let coverType: string | undefined = undefined;
    if (params.itemId) {
        coverType = "item";
    } else if (params.albumId) {
        coverType = "album";
    }

    console.log("browserheader ", coverType, album, track);

    return (
        <Box
            {...props}
            sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignSelf: "flex-start",
                    alignItems: "flex-start",
                }}
            >
                <LinkTypography
                    sx={{
                        fontSize: "1.5rem",
                        lineHeight: 1.0,
                    }}
                    label={artist}
                    target="artist"
                    params={params}
                />
                <LinkTypography
                    sx={{
                        fontSize: "1.2rem",
                        lineHeight: 1.0,
                        marginTop: "0.5rem",
                    }}
                    label={album}
                    target="album"
                    params={params}
                />
                <LinkTypography
                    sx={{
                        fontSize: "1.0rem",
                        fontStyle: "italic",
                        marginTop: "0.5rem",
                        lineHeight: 1.0,
                    }}
                    label={track}
                />
            </Box>
            {(album ?? track) && (
                <CoverArt
                    sx={{ marginBottom: "auto" }}
                    type={coverType}
                    itemId={params.itemId}
                    albumId={params.albumId}
                />
            )}
        </Box>
    );
}

interface RouteParams {
    artist?: string;
    albumId?: number;
    itemId?: number;
}

interface LinkTypographyProps {
    target?: "artist" | "album" | "library";
    label?: string;
    params?: RouteParams;
    sx?: SxProps;
}

function LinkTypography({
    target = "library",
    label,
    params,
    sx,
}: LinkTypographyProps) {
    if (!label) {
        return <></>;
    }
    if (!params) {
        return <Typography sx={sx}>{label}</Typography>;
    }
    let to = `/library/browse`;
    if (target == "artist") {
        to = `/library/browse/${params.artist}`;
    } else if (target == "album") {
        to = `/library/browse/${params.artist}/${params.albumId}`;
    }
    return (
        <Link to={to} preload={"intent"} preloadDelay={2000}>
            <Typography sx={sx}>{label}</Typography>
        </Link>
    );
}
