import { Disc3Icon, UserRoundIcon } from "lucide-react";
import { Box, BoxProps, Typography, useMediaQuery, useTheme } from "@mui/material";

import { ItemResponse } from "@/pythonTypes";

import { DotSeparatedList } from "./album";
import { MultiCoverArt } from "./coverArt";

import { Link } from "../common/link";
import { humanizeBytes } from "../common/units/bytes";

export function ItemHeader({
    item,
    sx,
    ...props
}: {
    item: ItemResponse;
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
