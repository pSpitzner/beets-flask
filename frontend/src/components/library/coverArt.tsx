import { FileWarning } from "lucide-react";
import { useState } from "react";
import { Button } from "@mui/material";
import Box, { BoxProps } from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import { SxProps } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";

import { APIError } from "@/api/common";
import { artQueryOptions, ArtSize, numArtQueryOptions } from "@/api/library";

export interface CoverArtProps extends BoxProps {
    type: "item" | "album";
    beetsId?: number;
    size?: ArtSize;
    index?: number;
}

/** Cover art
 *
 * Shows the cover art for an item or album.
 */
export function CoverArt({
    type,
    beetsId,
    size = "medium",
    sx,
    index,
    ...props
}: CoverArtProps) {
    const {
        data: art,
        isPending,
        isError,
        error,
    } = useQuery(artQueryOptions({ type, id: beetsId, size, index: index }));

    const coverSx = [
        {
            height: 100,
            width: 100,
            aspectRatio: "1 / 1",
            overflow: "hidden",
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ...(Array.isArray(sx) ? sx : [sx]),
    ] as SxProps;

    if (isPending) {
        return <CoverArtPlaceholder sx={coverSx} animation="wave" {...props} />;
    }

    if (isError) {
        if (error instanceof APIError) {
            // Depending on the error we show a placeholder or an error message
            if (error.statusCode === 404) {
                // 404 means no cover art found, so we show a placeholder
                return (
                    <CoverArtPlaceholder sx={coverSx} animation={false} {...props} />
                );
            }
            return <CoverArtError sx={coverSx} error={error} size={size} {...props} />;
        } else {
            throw error;
        }
    }

    if (art) {
        return <CoverArtContent sx={coverSx} src={art} {...props} />;
    } else {
        return <CoverArtPlaceholder sx={coverSx} animation={false} {...props} />;
    }
}

function CoverArtPlaceholder({
    animation,
    ...props
}: {
    animation: false | "pulse" | "wave" | undefined;
} & Partial<BoxProps>) {
    return (
        <Box {...props}>
            <Skeleton
                variant="rectangular"
                animation={animation}
                height="100%"
                width="100%"
            />
        </Box>
    );
}

function CoverArtContent({ src, ...props }: { src: string } & Partial<BoxProps>) {
    return <Box component="img" src={src} {...props} />;
}

function CoverArtError({
    error,
    size,
    ...props
}: { error: APIError; size: ArtSize } & Partial<BoxProps>) {
    console.log("CoverArtError", error);
    return (
        <Box {...props}>
            <Box
                sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "2rem",
                    border: "1px solid",
                    color: "error.main",
                    flexDirection: "column",
                    gap: 1,
                    p: 0.5,
                }}
            >
                <FileWarning size={50} strokeWidth={2} />
                {size === "large" && (
                    <Box
                        sx={{
                            width: "100%",
                            alignItems: "center",
                            fontSize: "0.8rem",
                            color: "error.main",
                            p: 1,
                        }}
                    >
                        <b>{error.name}</b> - {error.message}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

/** A bit more complex version of the normal cover.
 *
 * Specific for items and allows to show all artworks of
 * a given item.
 */
export function MultiCoverArt({
    beetsId,
    size,
    coverArtSx,
    ...props
}: Omit<CoverArtProps, "type"> & BoxProps & { coverArtSx?: BoxProps["sx"] }) {
    const [currentIdx, setCurrentIdx] = useState(0);

    const { data: numArtworks } = useQuery(numArtQueryOptions(beetsId));

    return (
        <Box position="relative" {...props}>
            {numArtworks && numArtworks.count > 1 && (
                <Button
                    variant="text"
                    sx={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        m: 0,
                        p: 1,
                        minWidth: 0,
                    }}
                    onClick={() => {
                        setCurrentIdx((prev) => (prev + 1) % numArtworks.count);
                    }}
                >
                    {
                        //Dot for each artwork
                        Array.from({ length: numArtworks.count }).map((_, idx) => (
                            <Box
                                key={idx}
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor:
                                        currentIdx === idx
                                            ? "primary.main"
                                            : "text.secondary",
                                    marginLeft: 0.5,
                                }}
                            />
                        ))
                    }
                </Button>
            )}
            <CoverArt
                type="item"
                beetsId={beetsId}
                size={size}
                index={currentIdx}
                sx={[
                    {
                        maxWidth: "100%",
                        maxHeight: "100%",
                        width: "auto",
                        height: "100%",
                        aspectRatio: "1 / 1",
                        m: 0,
                        borderRadius: 2,
                        objectFit: "contain",
                    },
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    ...(Array.isArray(coverArtSx) ? coverArtSx : [coverArtSx]),
                ]}
            />
        </Box>
    );
}
