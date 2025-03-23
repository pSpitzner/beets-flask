import { Box, Chip,Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import {
    FileTypeIcon,
    FolderStatusIcon,
    FolderTypeIcon,
    PenaltyTypeIcon,
    SourceTypeIcon,
} from "@/components/common/icons";
import { PageWrapper } from "@/components/common/page";
import { FolderStatus } from "@/pythonTypes";

export const Route = createFileRoute("/_debug/design/icons")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <PageWrapper sx={{ gap: "1rem", display: "flex", flexDirection: "column" }}>
            <Box>
                <Typography
                    variant="h1"
                    gutterBottom
                    sx={{ textAlign: "center", fontSize: "2rem", fontWeight: "bold" }}
                >
                    Icons
                </Typography>
                <Typography variant="body1">
                    This page may be used to get an explanation of the icons and their
                    meaning. Additionally, this page is for debugging the icons that are
                    currently available in the frontend. This is useful to check if the
                    icons are correctly displayed and if they are coherent with the
                    design.
                </Typography>
            </Box>
            <Box>
                <Typography
                    variant="h2"
                    gutterBottom
                    sx={{ fontSize: "1.5rem", fontWeight: "bold" }}
                >
                    Status icons
                </Typography>
                <Typography variant="body1">
                    Status icons are used to indicate the status of a running beets job.
                    Normally status icons are attached to a folder and are visible in
                    the inbox view.
                </Typography>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "auto auto",
                        columnGap: 2,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        paddingX: 2,
                        paddingY: 1,
                    }}
                >
                    Unknown
                    <FolderStatusIcon status={FolderStatus.UNKNOWN} size={20} />
                    Failed
                    <FolderStatusIcon status={FolderStatus.FAILED} size={20} />
                    Not started
                    <FolderStatusIcon status={FolderStatus.NOT_STARTED} size={20} />
                    Pending
                    <FolderStatusIcon status={FolderStatus.PENDING} size={20} />
                    Running
                    <FolderStatusIcon status={FolderStatus.RUNNING} size={20} />
                    Tagged
                    <FolderStatusIcon status={FolderStatus.TAGGED} size={20} />
                    Imported
                    <FolderStatusIcon status={FolderStatus.IMPORTED} size={20} />
                </Box>
            </Box>

            <Box>
                <Typography
                    variant="h2"
                    gutterBottom
                    sx={{ fontSize: "1.5rem", fontWeight: "bold" }}
                >
                    Source Type Icons
                </Typography>
                <Typography variant="body1">
                    Source type icons are used to indicate the data source of a match.
                    Normally they have an associated quality percentage and are shown in
                    a chip.
                </Typography>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "auto auto",
                        columnGap: 2,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        paddingX: 2,
                        paddingY: 1,
                    }}
                >
                    Spotify
                    <SourceTypeIcon type="spotify" size={20} />
                    Musicbrainz
                    <SourceTypeIcon type="musicbrainz" size={20} />
                    Asis
                    <SourceTypeIcon type="asis" size={20} />
                    Unknown
                    <SourceTypeIcon type="unknown" size={20} />
                </Box>
            </Box>
            <Box>
                <Typography
                    variant="h2"
                    gutterBottom
                    sx={{ fontSize: "1.5rem", fontWeight: "bold" }}
                >
                    Penalty Icons
                </Typography>
                <Typography variant="body1">
                    Penalty icons are used to indicate the reason a match was penalized.
                    Normally penalty icons are attached to a match and are visible in
                    the todo view. Usually the icons are colored by the severity of the
                    penalty.
                </Typography>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "auto auto",
                        columnGap: 2,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        paddingX: 2,
                        paddingY: 1,
                    }}
                >
                    Artist
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="artist" size={20} />
                        <PenaltyTypeIcon type="artist" size={20} color={"red"} />
                        <PenaltyTypeIcon type="artist" size={20} color={"orange"} />
                        <PenaltyTypeIcon type="artist" size={20} color={"yellow"} />
                        <PenaltyTypeIcon type="artist" size={20} color={"green"} />
                    </Box>
                    Album
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="album" size={20} />
                        <PenaltyTypeIcon type="album" size={20} color={"red"} />
                        <PenaltyTypeIcon type="album" size={20} color={"orange"} />
                        <PenaltyTypeIcon type="album" size={20} color={"yellow"} />
                        <PenaltyTypeIcon type="album" size={20} color={"green"} />
                    </Box>
                    Tracks
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="tracks" size={20} />
                        <PenaltyTypeIcon type="tracks" size={20} color={"red"} />
                        <PenaltyTypeIcon type="tracks" size={20} color={"orange"} />
                        <PenaltyTypeIcon type="tracks" size={20} color={"yellow"} />
                        <PenaltyTypeIcon type="tracks" size={20} color={"green"} />
                    </Box>
                    Unmatched Tracks
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="unmatched_tracks" size={20} />
                        <PenaltyTypeIcon
                            type="unmatched_tracks"
                            size={20}
                            color={"red"}
                        />
                        <PenaltyTypeIcon
                            type="unmatched_tracks"
                            size={20}
                            color={"orange"}
                        />
                        <PenaltyTypeIcon
                            type="unmatched_tracks"
                            size={20}
                            color={"yellow"}
                        />
                        <PenaltyTypeIcon
                            type="unmatched_tracks"
                            size={20}
                            color={"green"}
                        />
                    </Box>
                    Missing Tracks
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="missing_tracks" size={20} />
                        <PenaltyTypeIcon
                            type="missing_tracks"
                            size={20}
                            color={"red"}
                        />
                        <PenaltyTypeIcon
                            type="missing_tracks"
                            size={20}
                            color={"orange"}
                        />
                        <PenaltyTypeIcon
                            type="missing_tracks"
                            size={20}
                            color={"yellow"}
                        />
                        <PenaltyTypeIcon
                            type="missing_tracks"
                            size={20}
                            color={"green"}
                        />
                    </Box>
                    Media
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="media" size={20} />
                        <PenaltyTypeIcon type="media" size={20} color={"red"} />
                        <PenaltyTypeIcon type="media" size={20} color={"orange"} />
                        <PenaltyTypeIcon type="media" size={20} color={"yellow"} />
                        <PenaltyTypeIcon type="media" size={20} color={"green"} />
                    </Box>
                    Mediums
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="mediums" size={20} />
                        <PenaltyTypeIcon type="mediums" size={20} color={"red"} />
                        <PenaltyTypeIcon type="mediums" size={20} color={"orange"} />
                        <PenaltyTypeIcon type="mediums" size={20} color={"yellow"} />
                        <PenaltyTypeIcon type="mediums" size={20} color={"green"} />
                    </Box>
                    Country
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="country" size={20} />
                        <PenaltyTypeIcon type="country" size={20} color={"red"} />
                        <PenaltyTypeIcon type="country" size={20} color={"orange"} />
                        <PenaltyTypeIcon type="country" size={20} color={"yellow"} />
                        <PenaltyTypeIcon type="country" size={20} color={"green"} />
                    </Box>
                    Year
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="year" size={20} />
                        <PenaltyTypeIcon type="year" size={20} color={"red"} />
                        <PenaltyTypeIcon type="year" size={20} color={"orange"} />
                        <PenaltyTypeIcon type="year" size={20} color={"yellow"} />
                        <PenaltyTypeIcon type="year" size={20} color={"green"} />
                    </Box>
                    Duplicate
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="duplicate" size={20} />
                        <PenaltyTypeIcon type="duplicate" size={20} color={"red"} />
                        <PenaltyTypeIcon type="duplicate" size={20} color={"orange"} />
                        <PenaltyTypeIcon type="duplicate" size={20} color={"yellow"} />
                        <PenaltyTypeIcon type="duplicate" size={20} color={"green"} />
                    </Box>
                </Box>
            </Box>
            <Box>
                <Typography
                    variant="h2"
                    gutterBottom
                    sx={{ fontSize: "1.5rem", fontWeight: "bold" }}
                >
                    File & Folder Types
                </Typography>
                <Typography variant="body1">
                    File and folder type icons are used to indicate the type of a file
                    or folder. Normally file and folder type icons are attached to a
                    file or folder and are visible in the inbox view.
                </Typography>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "auto auto",
                        columnGap: 2,
                        justifyContent: "flex-start",
                        alignItems: "center",
                        paddingX: 2,
                        paddingY: 1,
                    }}
                >
                    Audio File
                    <FileTypeIcon type="mp3" size={20} />
                    Other File
                    <FileTypeIcon type="txt" size={20} />
                    Directory
                    <Box display="flex" gap={1}>
                        <FolderTypeIcon isAlbum={false} isOpen={false} size={20} />
                        <FolderTypeIcon isAlbum={false} isOpen={true} size={20} />
                    </Box>
                    Album Folder
                    <Box display="flex" gap={1}>
                        <FolderTypeIcon isAlbum={true} isOpen={false} size={20} />
                        <FolderTypeIcon isAlbum={true} isOpen={true} size={20} />
                    </Box>
                </Box>
            </Box>
        </PageWrapper>
    );
}
