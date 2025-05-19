import { DotIcon } from "lucide-react";
import { Fragment, useMemo } from "react";
import { Box, BoxProps, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Link } from "@tanstack/react-router";

import { AlbumResponseExpanded, ItemResponse } from "@/pythonTypes";

import { PlayOrAddItemToQueueButton } from "./audio/utils";
import { CoverArt } from "./coverArt";

import { capitalizeFirstLetter } from "../common/strings";
import { humanizeDuration } from "../common/units/time";

/**  */
export function AlbumHeader({
    album,
    sx,
    ...props
}: {
    album: AlbumResponseExpanded;
} & BoxProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down("tablet"));

    return (
        <Box
            sx={[
                (theme) => ({
                    display: "grid",
                    gap: 2,
                    padding: 2,
                    [theme.breakpoints.up("tablet")]: {
                        gridTemplateColumns: "[art] 200px [content] 1fr",
                    },
                }),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            <CoverArt
                type="album"
                beetsId={album.id}
                sx={{
                    maxWidth: "200px",
                    height: "100%",
                    width: "100%",
                    margin: 0,
                    borderRadius: 2,
                    alignSelf: "center",
                    justifySelf: "center",
                    boxShadow: 3,
                    overflow: "hidden",
                }}
            />
            <Box
                sx={(theme) => ({
                    display: "flex",
                    flexDirection: "column",
                    alignSelf: "flex-end",
                    gap: 2,
                    [theme.breakpoints.down("tablet")]: {
                        gap: 0,
                    },
                })}
            >
                <Box>
                    {!isMobile && (
                        <Typography variant="body1" color="text.secondary">
                            {album.albumtype && capitalizeFirstLetter(album.albumtype)}
                        </Typography>
                    )}
                    <Typography
                        variant="h3"
                        fontWeight="bold"
                        sx={(theme) => ({
                            [theme.breakpoints.up("laptop")]: {
                                fontSize: 60,
                            },
                        })}
                    >
                        {album.name}
                    </Typography>
                    {isMobile && (
                        <Typography variant="body1" fontWeight="bold" mt={0}>
                            {album.albumartist}
                        </Typography>
                    )}
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    {!isMobile && (
                        <>
                            <Typography
                                variant="body1"
                                fontWeight="bold"
                                component="span"
                            >
                                {album.albumartist}
                            </Typography>
                            <DotIcon
                                size={theme.iconSize.xl}
                                color={theme.palette.text.secondary}
                                style={{ marginLeft: "-4px", marginRight: "-4px" }}
                            />
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                component="span"
                            >
                                {album.year}
                            </Typography>
                        </>
                    )}
                    {isMobile && album.albumtype && (
                        <>
                            <Typography variant="body2" color="text.secondary">
                                {album.albumtype &&
                                    capitalizeFirstLetter(album.albumtype)}
                            </Typography>
                            <DotIcon
                                size={theme.iconSize.lg}
                                color={theme.palette.text.secondary}
                                style={{ marginLeft: "-3px", marginRight: "-3px" }}
                            />
                        </>
                    )}
                    {isMobile && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            component="span"
                        >
                            {album.year}
                        </Typography>
                    )}
                    {!isMobile && (
                        <>
                            <DotIcon
                                size={theme.iconSize.xl}
                                color={theme.palette.text.secondary}
                                style={{ marginLeft: "-4px", marginRight: "-4px" }}
                            />
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                component="span"
                            >
                                {album.items.length} track
                                {album.items.length > 1 ? "s" : ""}
                            </Typography>
                            <DotIcon
                                size={theme.iconSize.xl}
                                color={theme.palette.text.secondary}
                                style={{ marginLeft: "-4px", marginRight: "-4px" }}
                            />
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                component="span"
                            >
                                {humanizeDuration(
                                    album.items.reduce((a, b) => a + b.length, 0)
                                )}
                            </Typography>
                        </>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

export function Tracklist({ items, ...props }: { items: ItemResponse[] } & BoxProps) {
    if (items.length === 0) {
        return (
            <Box sx={{ flex: "1 1 auto", height: "100%" }}>
                <Typography variant="body2" color="text.secondary">
                    No tracks found
                </Typography>
            </Box>
        );
    }

    return (
        <Box {...props}>
            <Typography variant="overline">
                {items.length == 0 ? "No tracks" : items.length} track
                {items.length > 1 ? "s" : ""}
            </Typography>
            <Box
                sx={{
                    height: "100%",
                    display: "grid",
                    gap: 1.5,
                    flexDirection: "column",
                    overflow: "auto",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                }}
            >
                {items.map((item) => (
                    <Fragment key={item.id}>
                        <Link
                            style={{
                                flexDirection: "column",
                                alignItems: "flex-start",
                                justifyContent: "center",
                                fontWeight: "bold",
                                display: "subgrid",
                            }}
                            to={`/library/item/$itemId`}
                            params={{ itemId: item.id }}
                        >
                            <Typography variant="body1">{item.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {item.artist}
                            </Typography>
                        </Link>
                        <PlayOrAddItemToQueueButton item={item} />
                    </Fragment>
                ))}
            </Box>
        </Box>
    );
}
