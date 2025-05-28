import {
    ActivityIcon,
    AudioWaveformIcon,
    BarcodeIcon,
    ClockIcon,
    FileMusicIcon,
    GuitarIcon,
    LayersIcon,
    ListIcon,
    MicVocalIcon,
    MusicIcon,
    PackageIcon,
} from "lucide-react";
import { Chip, ChipProps, styled, Tooltip, useTheme } from "@mui/material";
import Box from "@mui/material/Box";

import { FileMetadata } from "@/api/inbox";
import { humanizeBytes } from "@/components/common/units/bytes";
import { trackLengthRep } from "@/components/common/units/time";

import { PenaltyTypeIcon } from "../../common/icons";

// PS 2025-05-16
// I created an empty file, and these keys we we still got

// filename	/music/inbox/Annix/Antidote/empty.flac
// filesize	30929699
// duration	224.77544217687074
// channels	2
// bitrate	1100.821289032531
// bitdepth	16
// samplerate	44100

// ARTIST (merge / combine / prio/ info from below fields)
// artist	Annix
// composer	Annix
// album artist	Annix
// album_artist	Annix
// albumartist	Annix
// albumartist_credit	Annix
// albumartistsort	Annix
// artist_credit	Annix
// artistsort	Annix

// ALBUM
// album	Antidote

// TITLE
// title	Antidote

// LABEL
// label	DnB Allstars Records
// publisher	DnB Allstars Records

// GENRE
// genre	Drum And Bass, Electronic

// catalog_number	DNBA015
// isrc	GB8KE2159647

// DATE
// year	2021-02-19
// originaldate	2021-02-19
// _year	2021

// DISC STATS
// compilation	0
// disc	1
// disc_total	1
// _disc	1
// discc	1
// track	1
// track_total	1
// _track	1
// trackc	1
// media	Digital Media

// TLDR
// copyright	℗ 2021 Copyright Control
// releasestatus	Official
// releasetype	s
// bpm	0
// releasecountry	XW
// language	eng
// musicbrainz_albumstatus	Official
// musicbrainz_albumtype	s
// musicbrainz_albumartistid	b7c65173-4a6c-4add-b468-7e16c0833038
// musicbrainz_albumid	a25664c1-6db7-43db-9e32-1f1f249dbecc
// musicbrainz_artistid	b7c65173-4a6c-4add-b468-7e16c0833038
// musicbrainz_releasegroupid	b3db3a9c-9ca8-4437-b469-0a5208ce49f9
// musicbrainz_releasetrackid	8c850a41-d891-4050-9111-ef0201eb8cba
// musicbrainz_trackid	6cc80949-2152-4b94-ba8d-7de353f172ef
// script	Latn

type MetaChipType =
    | "filepath"
    | "artist"
    | "album"
    | "track"
    | "title"
    | "label"
    | "genre"
    | "year"
    | "duration"
    | "filesize"
    | "bitrate"
    | "bpm"
    | "compilation"
    | "identifiers"
    | "lyrics"
    | "remaining";

export function MetaChip({ meta, type }: { meta: FileMetadata; type: MetaChipType }) {
    const theme = useTheme();
    const knownKeys = [
        "filename",
        "artist",
        "composer",
        "album_artist",
        "albumartist",
        "albumartistsort",
        "artist_credit",
        "artistsort",
        "album",
        "track", // (track number)
        "title",
        "label",
        "publisher",
        "genre",
        "genres",
        "year",
        "originaldate",
        "_year",
        "duration",
        "filesize",
        "bitrate",
        "bpm",
        "compilation",
        "catalog_number",
        "catalognum",
        "isrc",
        "lyrics",
    ];
    const excludedKeys = ["traktor4"];

    const unknownKeys = Object.keys(meta).filter(
        (k) => !knownKeys.includes(k) && !excludedKeys.includes(k)
    );

    switch (type) {
        case "filepath":
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={["filename"]}
                    icon={<FileMusicIcon size={theme.iconSize.xs} />}
                    // variant="outlined"
                />
            );
        case "artist":
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={[
                        "artist",
                        "composer",
                        "album_artist",
                        "albumartist",
                        "albumartistsort",
                        "artist_credit",
                        "artistsort",
                    ]}
                    icon={<PenaltyTypeIcon type="artist" size={theme.iconSize.xs} />}
                    // sx={{ fontWeight: "400" }}
                    // variant="outlined"
                />
            );
        case "album":
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={["album"]}
                    icon={<PenaltyTypeIcon type="album" size={theme.iconSize.xs} />}
                    // variant="outlined"
                />
            );
        case "track":
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={["track"]}
                    variant="outlined"
                    sx={{ paddingLeft: 0 }}
                />
            );
        case "title":
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={["title"]}
                    icon={<MusicIcon size={theme.iconSize.xs} />}
                    variant="outlined"
                />
            );
        case "label":
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={["label", "publisher"]}
                    icon={<PenaltyTypeIcon type="label" size={theme.iconSize.xs} />}
                />
            );
        case "genre":
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={["genre", "genres"]}
                    icon={<GuitarIcon size={theme.iconSize.xs} />}
                />
            );
        case "year":
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={["year", "originaldate", "_year"]}
                    icon={<PenaltyTypeIcon type="year" size={theme.iconSize.xs} />}
                />
            );
        case "duration":
            return (
                <Tooltip title={"duration"}>
                    <StyledChip
                        size="small"
                        icon={<ClockIcon size={theme.iconSize.xs} />}
                        label={trackLengthRep(meta["duration"] as number, false)}
                    />
                </Tooltip>
            );
        case "filesize":
            return (
                <Tooltip title={"filesize"}>
                    <StyledChip
                        size="small"
                        icon={<PackageIcon size={theme.iconSize.xs} />}
                        label={humanizeBytes(meta["filesize"] as number)}
                    />
                </Tooltip>
            );
        case "bitrate":
            return (
                <Tooltip title={"bitrate"}>
                    <StyledChip
                        size="small"
                        icon={<AudioWaveformIcon size={theme.iconSize.xs} />}
                        label={
                            meta["bitrate"] !== undefined
                                ? `${(meta["bitrate"] as number).toFixed(1)} kbps`
                                : ""
                        }
                    />
                </Tooltip>
            );
        case "bpm":
            if (!meta["bpm"] || meta["bpm"] == 0) return null;
            return (
                <Tooltip title={"tempo"}>
                    <StyledChip
                        size="small"
                        icon={<ActivityIcon size={theme.iconSize.xs} />}
                        label={`${meta["bpm"]} bpm`}
                    />
                </Tooltip>
            );
        case "compilation":
            if (!meta["compilation"] || meta["compilation"] == 0) return null;
            return (
                <Tooltip title={"compilation"}>
                    <StyledChip
                        size="small"
                        icon={<LayersIcon size={theme.iconSize.xs} />}
                        sx={{
                            paddingRight: theme.spacing(0),
                            paddingLeft: theme.spacing(1),
                        }}
                    />
                </Tooltip>
            );
        case "identifiers":
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={[
                        "isrc",
                        "catalognum",
                        "catalog_number",
                        "musicbrainz_trackid",
                        "musicbrainz_releasetrackid",
                    ]}
                    icon={<BarcodeIcon size={theme.iconSize.xs} />}
                />
            );
        case "lyrics":
            if (!meta["lyrics"] || meta["lyrics"] == 0) return null;
            return (
                <Tooltip title={<pre>{meta["lyrics"].toString()}</pre>} sx={{}}>
                    <StyledChip
                        size="small"
                        icon={<MicVocalIcon size={theme.iconSize.xs} />}
                        sx={{
                            paddingRight: theme.spacing(0),
                            paddingLeft: theme.spacing(1),
                        }}
                    />
                </Tooltip>
            );
        case "remaining":
            // everything that is not covered above
            return (
                <GenericMetaChip
                    meta={meta}
                    keys={unknownKeys}
                    label={"more"}
                    icon={<ListIcon size={theme.iconSize.xs} />}
                />
            );

        default:
            return null;
    }
}

function GenericMetaChip({
    meta,
    keys,
    icon,
    label,
    ...props
}: {
    meta: FileMetadata;
    keys: string[];
    icon?: JSX.Element;
    label?: string;
} & ChipProps) {
    const filtered = Object.fromEntries(
        Object.entries(meta)
            .filter(([k, v]) => keys.includes(k) && v !== undefined)
            .sort(([a], [b]) => keys.indexOf(a) - keys.indexOf(b))
    );

    const key = Object.keys(filtered)[0];
    const autoLabel = Object.values(filtered)[0];
    if (!key) return null;

    let tooltip = <Box>{key}</Box>;
    if (Object.values(filtered).length > 1) {
        tooltip = (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 0.5 }}>
                {Object.entries(filtered).map(([k, v]) => (
                    <>
                        <Box sx={{ textAlign: "right" }}>{k}:</Box>
                        <Box sx={{ textAlign: "left" }}>{v}</Box>
                    </>
                ))}
            </Box>
        );
    }

    return (
        <Tooltip title={tooltip}>
            <StyledChip
                size="small"
                icon={icon}
                label={label || autoLabel}
                {...props}
            />
        </Tooltip>
    );
}

const StyledChip = styled(Chip)(({ theme }) => ({
    // PS: would like to add size="small" but snippet below broke typing
    paddingLeft: theme.spacing(0.5),
    display: "flex",
    justifyContent: "flex-start",
}));

// const StyledChip = styled((props) => <Chip size="small" {...props} />)(({ theme }) => ({
//     paddingLeft: theme.spacing(0.5),
//     display: "flex",
//     justifyContent: "space-between",
// }));
