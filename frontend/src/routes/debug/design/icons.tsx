import { ChevronDownIcon } from "lucide-react";
import { Box, Typography, useTheme } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import {
    ChangeIcon,
    CollapseAllIcon,
    DeselectAllIcon,
    ExpandAllIcon,
    FileTypeIcon,
    FolderStatusIcon,
    FolderTypeIcon,
    InboxTypeIcon,
    PenaltyTypeIcon,
    SelectAllIcon,
    SourceTypeIcon,
} from "@/components/common/icons";
import { PageWrapper } from "@/components/common/page";
import { FolderStatus } from "@/pythonTypes";

export const Route = createFileRoute("/debug/design/icons")({
    component: RouteComponent,
});

function RouteComponent() {
    const theme = useTheme();

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
                    Importing
                    <FolderStatusIcon status={FolderStatus.IMPORTING} size={20} />
                    Previewing
                    <FolderStatusIcon status={FolderStatus.PREVIEWING} size={20} />
                    Previewed
                    <FolderStatusIcon status={FolderStatus.PREVIEWED} size={20} />
                    Imported
                    <FolderStatusIcon status={FolderStatus.IMPORTED} size={20} />
                    Undone
                    <FolderStatusIcon status={FolderStatus.DELETED} size={20} />
                    Undoing
                    <FolderStatusIcon status={FolderStatus.DELETING} size={20} />
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
                        <PenaltyTypeIcon
                            type="artist"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="artist"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="artist"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="artist"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
                    </Box>
                    Album
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="album" size={20} />
                        <PenaltyTypeIcon
                            type="album"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="album"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="album"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="album"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
                    </Box>
                    Tracks
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="tracks" size={20} />
                        <PenaltyTypeIcon
                            type="tracks"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="tracks"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="tracks"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="tracks"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
                    </Box>
                    Unmatched Tracks
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="unmatched_tracks" size={20} />
                        <PenaltyTypeIcon
                            type="unmatched_tracks"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="unmatched_tracks"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="unmatched_tracks"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="unmatched_tracks"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
                    </Box>
                    Unmatched items
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="unmatched_items" size={20} />
                        <PenaltyTypeIcon
                            type="unmatched_items"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="unmatched_items"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="unmatched_items"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="unmatched_items"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
                    </Box>
                    Media
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="media" size={20} />
                        <PenaltyTypeIcon
                            type="media"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="media"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="media"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="media"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
                    </Box>
                    Mediums
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="mediums" size={20} />
                        <PenaltyTypeIcon
                            type="mediums"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="mediums"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="mediums"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="mediums"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
                    </Box>
                    Country
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="country" size={20} />
                        <PenaltyTypeIcon
                            type="country"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="country"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="country"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="country"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
                    </Box>
                    Year
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="year" size={20} />
                        <PenaltyTypeIcon
                            type="year"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="year"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="year"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="year"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
                    </Box>
                    Duplicate
                    <Box display="flex" gap={0.5}>
                        <PenaltyTypeIcon type="duplicate" size={20} />
                        <PenaltyTypeIcon
                            type="duplicate"
                            size={20}
                            color={theme.palette.success.main}
                        />
                        <PenaltyTypeIcon
                            type="duplicate"
                            size={20}
                            color={theme.palette.warning.main}
                        />
                        <PenaltyTypeIcon
                            type="duplicate"
                            size={20}
                            color={theme.palette.error.main}
                        />
                        <PenaltyTypeIcon
                            type="duplicate"
                            size={20}
                            color={theme.palette.diffs.changed}
                        />
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
            <Box>
                <Typography
                    variant="h2"
                    gutterBottom
                    sx={{ fontSize: "1.5rem", fontWeight: "bold" }}
                >
                    Selection and utils
                </Typography>
                <Typography variant="body1">
                    Selection and utils icons are used to indicate the state of a
                    checkbox selection or a radio button. Normally these are used in
                    combination with a button and label.
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
                    Deselect all
                    <DeselectAllIcon size={20} />
                    Select all
                    <SelectAllIcon size={20} />
                    Expand
                    <ChevronDownIcon size={20} />
                    Collapse all
                    <CollapseAllIcon size={20} />
                    Expand all
                    <ExpandAllIcon size={20} />
                </Box>
            </Box>
            <Box>
                <Typography
                    variant="h2"
                    gutterBottom
                    sx={{ fontSize: "1.5rem", fontWeight: "bold" }}
                >
                    Inbox Types
                </Typography>
                <Typography variant="body1">
                    Inbox types show the configured type of the inbox. This is user
                    configurable and shows how the inbox behavior.
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
                    Auto tagging (preview + import)
                    <InboxTypeIcon size={20} type={"auto"} />
                    Preview only
                    <InboxTypeIcon size={20} type={"preview"} />
                    Bootleg
                    <InboxTypeIcon size={20} type={"bootleg"} />
                    Off (default)
                    <InboxTypeIcon size={20} />
                </Box>
            </Box>
            <Box>
                <Typography
                    variant="h2"
                    gutterBottom
                    sx={{ fontSize: "1.5rem", fontWeight: "bold" }}
                >
                    Change Types
                </Typography>
                <Typography variant="body1">
                    Change types are show for track diffs, to indicate the type of
                    change that was made to the track.
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
                    Missing track
                    <ChangeIcon size={20} type={"unmatched_item"} />
                    Missing item
                    <ChangeIcon size={20} type={"unmatched_track"} />
                    Change minor
                    <ChangeIcon size={20} type={"change_minor"} />
                    Change major
                    <ChangeIcon size={20} type={"change_major"} />
                    No change
                    <ChangeIcon size={20} />
                </Box>
            </Box>
        </PageWrapper>
    );
}
