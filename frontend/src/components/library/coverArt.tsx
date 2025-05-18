import { FileWarning } from "lucide-react";
import Box, { BoxProps } from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import { SxProps } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";

import { APIError } from "@/api/common";
import { artQueryOptions, ArtSize } from "@/api/library";

export interface CoverArtProps extends BoxProps {
    type: "item" | "album";
    beetsId?: number;
    sx?: SxProps;
    size?: ArtSize;
    index?: number;
}

/** Cover art
 *
 * Shows the cover art for an item or album.
 */
export default function CoverArt({
    type,
    beetsId,
    size,
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

    const coverSx = {
        height: 100,
        width: 100,
        marginRight: "0.1rem",
        marginLeft: "0.1rem",
        aspectRatio: "1 / 1",
        overflow: "hidden",
        ...sx,
    } as SxProps;

    if (isPending) {
        return <CoverArtPlaceholder sx={coverSx} animation="wave" {...props} />;
    }

    if (isError) {
        if (error instanceof APIError) {
            return <CoverArtError sx={coverSx} error={error} {...props} />;
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
                width={(props.sx as { width: number | undefined }).width ?? 100}
                height={(props.sx as { height: number | undefined }).height ?? 100}
            />
        </Box>
    );
}

function CoverArtContent({ src, ...props }: { src: string } & Partial<BoxProps>) {
    return <Box component="img" src={src} {...props} />;
}

function CoverArtError({ error, ...props }: { error: APIError } & Partial<BoxProps>) {
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
                }}
            >
                <FileWarning size={50} strokeWidth={2} />
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
            </Box>
        </Box>
    );
}
