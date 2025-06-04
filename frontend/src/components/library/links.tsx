/** Link elements that allow to crossref between different resources.
 */

import { Disc3Icon, UserRoundIcon } from "lucide-react";
import { Typography, useTheme } from "@mui/material";

import { Link } from "../common/link";

export function ArtistLink({ artist }: { artist: string }) {
    const theme = useTheme();

    return (
        <Link
            to="/library/browse/artists/$artist"
            params={{ artist }}
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
                {artist}
            </Typography>
        </Link>
    );
}

export function AlbumLink({ albumId, title }: { albumId: number; title: string }) {
    const theme = useTheme();

    return (
        <Link
            to="/library/album/$albumId"
            params={{ albumId }}
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
                {title}
            </Typography>
        </Link>
    );
}
