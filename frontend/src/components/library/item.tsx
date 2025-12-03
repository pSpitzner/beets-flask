import { ChevronUpIcon, Disc3Icon, UserRoundIcon } from "lucide-react";
import {
    Box,
    BoxProps,
    IconButton,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";

import { ItemResponse } from "@/pythonTypes";

import { DotSeparatedList } from "./album";
import { CoverArt, MultiCoverArt } from "./coverArt";
import { AlbumLink, ArtistLink } from "./links";

import { useLocalStorage } from "../common/hooks/useLocalStorage";
import { useSwipeUp } from "../common/hooks/useSwipe";
import { Link } from "../common/link";
import { humanizeBytes } from "../common/units/bytes";

export function ItemHeader({
    item,
    sx,
    ...props
}: {
    item: ItemResponse;
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
                <ItemHeaderMinimal item={item} sx={sx} setExpanded={setExpanded} />
            ) : (
                <ItemHeaderExpanded item={item} sx={sx} setExpanded={setExpanded} />
            )}
        </Box>
    );
}
export function ItemHeaderExpanded({
    item,
    sx,
    setExpanded,
    ...props
}: {
    setExpanded: (expanded: boolean) => void;
    item: ItemResponse;
} & BoxProps) {
    const theme = useTheme();
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
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                }}
            >
                <MultiCoverArt
                    beetsId={item.id}
                    sx={{
                        maxWidth: "200px",
                        height: "100%",
                        width: "100%",
                        margin: 0,
                        borderRadius: 2,
                        alignSelf: "center",
                        justifySelf: "center",
                        boxShadow: 3,
                        aspectRatio: "1 / 1",
                        overflow: "hidden",
                        gridColumn: "2",
                    }}
                    coverArtSx={{
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
                            Track
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
                        {item.name}
                    </Typography>
                    {isMobile && (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                flexWrap: "wrap",
                            }}
                        >
                            <Link
                                to="/library/album/$albumId"
                                color="text.primary"
                                params={{ albumId: item.album_id }}
                                sx={{
                                    gap: 0.5,
                                    textDecoration: "none",
                                    color: "text.primary",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                <UserRoundIcon size={theme.iconSize.sm} color="gray" />
                                <Typography variant="body1" fontWeight="bold">
                                    {item.artist}
                                </Typography>
                            </Link>
                            <Link
                                to="/library/album/$albumId"
                                underline="none"
                                color="text.primary"
                                params={{ albumId: item.album_id }}
                                sx={{
                                    gap: 0.5,
                                    textDecoration: "none",
                                    color: "text.primary",
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                <Disc3Icon size={theme.iconSize.sm} color="gray" />
                                <Typography variant="body1" fontWeight="bold">
                                    {item.album}
                                </Typography>
                            </Link>
                        </Box>
                    )}
                </Box>

                {/* Album ref*/}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                    }}
                >
                    {!isMobile && (
                        <DotSeparatedList>
                            <ArtistLink artist={item.artist} />
                            <AlbumLink title={item.album} albumId={item.album_id} />
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                component="span"
                            >
                                Track
                            </Typography>
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                component="span"
                            >
                                {item.year}
                            </Typography>
                            <Typography
                                variant="body1"
                                color="text.secondary"
                                component="span"
                            >
                                {humanizeBytes(item.size)} {item.format}
                            </Typography>
                        </DotSeparatedList>
                    )}
                    {isMobile && (
                        <DotSeparatedList>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                component="span"
                            >
                                Track
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                component="span"
                            >
                                {item.year}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                component="span"
                            >
                                {humanizeBytes(item.size)} {item.format}
                            </Typography>
                        </DotSeparatedList>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

export function ItemHeaderMinimal({
    item,
    sx,
    setExpanded,
    ...props
}: {
    item: ItemResponse;
    setExpanded: (expanded: boolean) => void;
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
                {item.name}
            </Typography>
            <CoverArt
                type="item"
                beetsId={item.id}
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
