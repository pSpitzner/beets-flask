import {
    AudioLinesIcon,
    BadgeAlertIcon,
    BrainIcon,
    CalendarIcon,
    CassetteTapeIcon,
    CircleCheckBigIcon,
    CircleHelpIcon,
    CopyIcon,
    Disc3Icon,
    FastForward,
    FileIcon,
    FlagIcon,
    FolderIcon,
    FolderOpen,
    GitPullRequestArrowIcon,
    HourglassIcon,
    LucideProps,
    MusicIcon,
    SearchXIcon,
    TagsIcon,
    Tally5Icon,
    TriangleAlertIcon,
    UserRoundIcon,
} from "lucide-react";
import { CircularProgress, Tooltip } from "@mui/material";

import { FolderStatus } from "@/pythonTypes";

import { GrowingRipple } from "./loading";

/** Icon to show a folder, shows a disc icon if the folder is an album.
 *
 * isAlbum: if the folder is an album
 * isOpen: if the folder is open
 */
export function FolderTypeIcon({
    isAlbum,
    isOpen,
    ...props
}: { isAlbum: boolean; isOpen: boolean } & LucideProps) {
    if (isAlbum) {
        return (
            <Disc3Icon
                style={{
                    transform: isOpen ? "rotate(90deg)" : "",
                    transition: "transform 0.15s ease-in-out",
                }}
                {...props}
            />
        );
    } else {
        if (isOpen) {
            return <FolderOpen {...props} />;
        }
        return <FolderIcon {...props} />;
    }
}

/** Icon to show different file types.
 *
 * type: file type to show icon for (normally the ending of the file)
 */
export function FileTypeIcon({ type, ...props }: { type: string | undefined } & LucideProps) {
    switch (type) {
        case "mp3":
        case "flac":
        case "wav":
        case "ogg":
            return <MusicIcon {...props} />;
        default:
            return <FileIcon {...props} />;
    }
}

/** Icon to show different penalty types.
 */
export function PenaltyTypeIcon({ type, ...props }: { type: string } & LucideProps) {
    switch (type) {
        case "artist":
            return <UserRoundIcon {...props} />;
        case "album":
            return <Disc3Icon {...props} />;
        case "tracks":
            return <AudioLinesIcon {...props} />;
        case "unmatched_tracks":
            return <GitPullRequestArrowIcon {...props} />;
        case "missing_tracks":
            return <SearchXIcon {...props} />;
        case "media":
            return <CassetteTapeIcon {...props} />;
        case "mediums":
            return <Tally5Icon {...props} />;
        case "country":
            return <FlagIcon {...props} />;
        case "year":
            return <CalendarIcon {...props} />;
        case "duplicate":
            return <CopyIcon {...props} />;
        default:
            console.warn(`Unknown penalty kind: ${type}`);
            return null;
    }
}

/** Icon to show different source types.
 *
 * Source types are the source of a match e.g. spotify.
 */
export function SourceTypeIcon({ type, ...props }: { type: string } & LucideProps) {
    switch (type.toLowerCase()) {
        case "spotify":
            return <Spotify {...props} />;
        case "mb":
        case "musicbrainz":
            return <BrainIcon {...props} />;
        case "asis":
            return <FastForward {...props} />;
        default:
            console.warn(`Unknown source type: ${type}`);
            return <BadgeAlertIcon {...props} />;
    }
}

export function SourceTypeIconWithTooltip({ type, ...props }: { type: string } & LucideProps) {
    return (
        <Tooltip title={type === "asis" ? "Metadata from files" : type}>
            <SourceTypeIcon type={type} {...props} />
        </Tooltip>
    );
}

/** Shows the status of a folder */
export function FolderStatusIcon({ status, ...props }: { status: FolderStatus } & LucideProps) {
    switch (status) {
        case FolderStatus.UNKNOWN:
            return <CircleHelpIcon {...props} />;
        case FolderStatus.FAILED:
            return <TriangleAlertIcon {...props} />;
        case FolderStatus.NOT_STARTED:
            return <HourglassIcon {...props} />;
        case FolderStatus.PENDING:
            return <GrowingRipple size={props.size} color={props.color} />;
        case FolderStatus.RUNNING:
            return <CircularProgress size={props.size} sx={{ color: props.color || "inherit" }} />;
        case FolderStatus.TAGGED:
            return <TagsIcon {...props} />;
        case FolderStatus.IMPORTED:
            return <CircleCheckBigIcon {...props} />;
        default:
            return <CircleHelpIcon {...props} />;
    }
}

// Manually edited spotify svg icon (removing the circle)
function Spotify(props: LucideProps) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            version="1.1"
            {...props}
        >
            <path stroke="none" d="M 0,0 H 24 V 24 H 0 Z" fill="none" id="path2" />
            <g id="g1168" transform="matrix(0.85434442,0,0,0.85434442,1.7478672,-0.03136257)">
                <path
                    d="m 6.3949311,14.46672 c 3.7367129,-2.201671 8.2207679,-1.454328 11.2101379,0.7877"
                    id="path6"
                />
                <path
                    d="m 8.263287,18.991132 c 2.242028,-1.494685 5.978741,-1.494685 7.473426,0.747343"
                    id="path8"
                />
                <path
                    d="M 4.5265745,10.023022 C 7.5159444,8.5283366 13.494685,7.0336515 19.473425,10.770364"
                    id="path10"
                />
            </g>
        </svg>
    );
}
