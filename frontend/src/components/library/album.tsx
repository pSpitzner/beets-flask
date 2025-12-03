import { ChevronUpIcon, DotIcon } from "lucide-react";
import { Fragment, ReactNode } from "react";
import {
    Box,
    BoxProps,
    IconButton,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { Link } from "@tanstack/react-router";

import { AlbumResponseExpanded, ItemResponse } from "@/pythonTypes";

import { PlayOrAddItemToQueueButton } from "./audio/utils";
import { CoverArt } from "./coverArt";
import { ArtistLink } from "./links";

import { useLocalStorage } from "../common/hooks/useLocalStorage";
import { useSwipeUp } from "../common/hooks/useSwipe";
import { capitalizeFirstLetter } from "../common/strings";
import { humanizeDuration } from "../common/units/time";

export function AlbumHeader({
    album,
    sx,
    ...props
}: {
    album: AlbumResponseExpanded;
} & BoxProps) {
    const [expanded, setExpanded] = useLocalStorage("mobile_header_is_expanded", true);
    // TODO: A bit of animation would be nice here grow + shrink
    return (
        <Box
            sx={[
                {
                    overflow: "hidden",
                    display: "block",
                },
            ]}
            {...props}
        >
            {!expanded ? (
                <AlbumHeaderMinimal album={album} sx={sx} setExpanded={setExpanded} />
            ) : (
                <AlbumHeaderExpanded album={album} sx={sx} setExpanded={setExpanded} />
            )}
        </Box>
    );
}

export function AlbumHeaderExpanded({
    album,
    sx,
    setExpanded,
    ...props
}: {
    album: AlbumResponseExpanded;
    setExpanded: (expanded: boolean) => void;
} & BoxProps) {
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down("tablet"));
    const ref = useSwipeUp(() => setExpanded(false), 100);

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
            ref={ref}
            {...props}
        >
            <Box
                sx={{
                    height: "100%",
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                }}
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
                        objectFit: "contain",
                        ml: "auto",
                        gridColumn: "2",
                    }}
                />
                {isMobile && (
                    <Box sx={{ gridColumn: "3", justifySelf: "end" }}>
                        <IconButton onClick={() => setExpanded(false)}>
                            <ChevronUpIcon color={"gray"} />
                        </IconButton>
                    </Box>
                )}
            </Box>
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
                    {isMobile && <ArtistLink artist={album.albumartist} />}
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    {!isMobile && (
                        <DotSeparatedList>
                            <ArtistLink artist={album.albumartist} />
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                component="span"
                            >
                                {album.year}
                            </Typography>
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                component="span"
                            >
                                {album.items.length} track
                                {album.items.length > 1 ? "s" : ""}
                            </Typography>
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                component="span"
                            >
                                {humanizeDuration(
                                    album.items.reduce((a, b) => a + b.length, 0)
                                )}
                            </Typography>
                        </DotSeparatedList>
                    )}
                    {isMobile && (
                        <DotSeparatedList>
                            <Typography variant="body2" color="text.secondary">
                                {album.albumtype &&
                                    capitalizeFirstLetter(album.albumtype)}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                component="span"
                            >
                                {album.year}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                component="span"
                            >
                                {album.items.length} track
                                {album.items.length > 1 ? "s" : ""}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                component="span"
                            >
                                {humanizeDuration(
                                    album.items.reduce((a, b) => a + b.length, 0)
                                )}
                            </Typography>
                        </DotSeparatedList>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

// Minimal header for collapsed state
export function AlbumHeaderMinimal({
    album,
    sx,
    setExpanded,
    ...props
}: {
    setExpanded: (expanded: boolean) => void;
    album: AlbumResponseExpanded;
} & BoxProps) {
    return (
        <Box
            sx={[
                {
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    padding: 1,
                    minHeight: "60px",
                    justifyContent: "space-around",
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            onClick={() => setExpanded(true)}
            {...props}
        >
            <Typography
                variant="h6"
                fontWeight="bold"
                sx={{
                    flex: 1,
                    // Remove noWrap to allow text wrapping
                    whiteSpace: "normal",
                    lineHeight: 1.2,
                    textAlign: "right",
                    // add elipsis after two lines
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                }}
            >
                {album.name}
            </Typography>
            <CoverArt
                type="album"
                beetsId={album.id}
                sx={{
                    width: "45px",
                    height: "45px",
                    borderRadius: 1,
                    flexShrink: 0,
                    boxShadow: 1,
                }}
            />
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
                    flexDirection: "column",
                    overflow: "auto",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                }}
            >
                {items.map((item, i) => (
                    <Box
                        key={i}
                        sx={(theme) => ({
                            display: "grid",
                            padding: 1,
                            gridColumn: "span 2",
                            gridTemplateColumns: "1fr auto",
                            ":hover": {
                                background: `linear-gradient(to left, transparent 0%, ${theme.palette.primary.muted} 100%)`,
                            },
                        })}
                    >
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
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

export function DotSeparatedList({ children }: { children: ReactNode[] }) {
    const theme = useTheme();
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down("tablet"));

    // Dot size
    const mobileMargin = isMobile ? "-3px" : "-4px";
    const mobileSize = isMobile ? theme.iconSize.lg : theme.iconSize.xl;

    return (
        <Box sx={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap" }}>
            {children.map((child, index) => (
                <Fragment key={index}>
                    {child}
                    {index < children.length - 1 &&
                        children.length > 1 &&
                        child !== null && (
                            <DotIcon
                                size={mobileSize}
                                color={theme.palette.text.secondary}
                                style={{ marginInline: mobileMargin }}
                            />
                        )}
                </Fragment>
            ))}
        </Box>
    );
}
