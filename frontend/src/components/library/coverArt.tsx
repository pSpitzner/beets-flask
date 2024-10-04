import Box, { BoxProps } from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import { SxProps } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";

import { artQueryOptions } from "@/components/common/_query";

interface CoverArtProps {
    type?: string;
    albumId?: number;
    itemId?: number;
    sx?: SxProps;
    showPlaceholder?: boolean;
}

export default function CoverArt({
    type,
    albumId,
    itemId,
    sx,
    showPlaceholder = true,
    ...props
}: CoverArtProps & Partial<BoxProps>) {
    // in the library browse view, we can assume the album cover should is requested first and cached, and we only get the item-level cover second.
    const { data: albumArt } = useQuery({
        ...artQueryOptions({ type: "album", id: albumId }),
        enabled: albumId !== undefined && (type === undefined || type === "album"),
    });

    const { data: itemArt, isFetching: isFetchingItem } = useQuery({
        ...artQueryOptions({ type: "item", id: itemId }),
        enabled: itemId !== undefined && (type === undefined || type === "item"),
    });

    const coverSx = {
        height: 100,
        width: 100,
        marginRight: "0.1rem",
        marginLeft: "0.1rem",
        ...sx,
    } as SxProps;

    if (type === "album" && albumArt) {
        return <CoverArtContent sx={coverSx} src={albumArt} {...props} />;
    } else if (type === "item") {
        if (isFetchingItem && albumArt) {
            return <CoverArtContent sx={coverSx} src={albumArt} {...props} />;
        }
        if (itemArt) {
            return <CoverArtContent sx={coverSx} src={itemArt} {...props} />;
        }
    }

    // default case, nothing is loading and no cover found.
    if (showPlaceholder) {
        return <CoverArtPlaceholder sx={coverSx} animation={false} {...props} />;
    } else {
        return null;
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
                // @sm: any way to get dimensions from sx without type-errors?
                width={(props.sx as { width: number | undefined })?.width ?? 100}
                height={(props.sx as { height: number | undefined })?.height ?? 100}
            />
        </Box>
    );
}

function CoverArtContent({ src, ...props }: { src: string } & Partial<BoxProps>) {
    return <Box component="img" src={src} {...props} />;
}
