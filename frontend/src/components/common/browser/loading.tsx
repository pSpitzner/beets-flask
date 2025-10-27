import { memo } from "react";
import { Box, Skeleton, useTheme } from "@mui/material";

import { AlbumIcon, ArtistIcon, TrackIcon } from "../icons";

export interface LoadingRowProps {
    style: React.CSSProperties;
    icon: "album" | "artist" | "item" | null;
}

export const LoadingRow = memo(({ style, icon }: LoadingRowProps) => {
    const theme = useTheme();
    return (
        <Box
            sx={{
                ...style,
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: 2,
                paddingInline: 1,
            }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
                <Skeleton variant="text" animation={false} />
                <Skeleton variant="text" width="60%" animation={false} />
            </Box>
            {icon === "album" && <AlbumIcon color={theme.palette.background.paper} />}
            {icon === "artist" && <ArtistIcon color={theme.palette.background.paper} />}
            {icon === "item" && <TrackIcon color={theme.palette.background.paper} />}
        </Box>
    );
});

export const LoadingCell = memo(({ style }: { style: React.CSSProperties }) => {
    return (
        <Box
            sx={{
                ...style,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 1,
            }}
        >
            <Skeleton variant="rectangular" width="100%" height="100%" />
        </Box>
    );
});
