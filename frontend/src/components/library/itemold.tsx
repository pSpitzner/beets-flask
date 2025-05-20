import { ClockIcon, Disc3Icon, StickyNoteIcon } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import {
    BoxProps,
    Chip,
    Link,
    Stack,
    styled,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tabs,
    Typography,
    useTheme,
} from "@mui/material";
import Box from "@mui/material/Box";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { albumQueryOptions, Item as ItemT, itemQueryOptions } from "@/api/library";
import { ItemSource as ItemSourceT } from "@/pythonTypes";

import { AudioPlayerItem } from "./audio";
import { CoverArt } from "./coverArt";

import { SourceTypeIcon } from "../common/icons";
import { ClipboardCopyButton } from "../common/inputs/copy";
import { Search } from "../common/inputs/search";
import { trackLengthRep } from "../common/units/time";

export function ItemById({ itemId }: { itemId: number }) {
    const { data: item } = useSuspenseQuery(
        itemQueryOptions(itemId, false) // minimal
    );
    return <Item item={item} />;
}

/** A detailed view of an beets library item
 *
 */
export function Item({ item }: { item: ItemT<false> }) {
    return (
        <Box
            sx={(theme) => ({
                mx: "auto",
                maxWidth: theme.breakpoints.values.laptop,
                width: "100%",
                height: "100%",
            })}
        >
            <ItemGrid>
                <ArtSection
                    item={item}
                    sx={{
                        gridColumn: "cover",
                        alignSelf: "center",
                        justifySelf: "center",
                    }}
                />
                <SongInfo
                    item={item}
                    sx={{
                        gridColumn: "info",
                        width: "100%",
                    }}
                />
                <DetailsTabs
                    item={item}
                    sx={{
                        gridRow: "details",
                        gridColumn: "1 / -1",
                        width: "100%",
                        height: "100%",
                        overflow: "auto",
                        display: "flex",
                        flexDirection: "column",
                        flexGrow: 1,
                    }}
                />
            </ItemGrid>
        </Box>
    );
}

function ArtSection({ item, ...props }: { item: ItemT<false> } & BoxProps) {
    return (
        <Box {...props}>
            <CoverArt
                type="item"
                beetsId={item.id}
                sx={{
                    width: "200px",
                    height: "200px",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    borderRadius: 0,
                }}
            />
        </Box>
    );
}

function SongInfo({ item, ...props }: { item: ItemT<false> } & BoxProps) {
    const theme = useTheme();
    const navigate = useNavigate();

    // Get the album for the item
    const { data: album } = useSuspenseQuery(
        albumQueryOptions(
            item.album_id,
            true, // expand
            true // minimal
        )
    );

    const currentIdx = album?.items.findIndex((i) => i.id === item.id);

    return (
        <Box {...props}>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
                <Typography variant="h4" fontWeight="bold">
                    {item.name}
                </Typography>
                <Typography variant="h6" color="text.secondary" mt={0}>
                    {item.artist}
                </Typography>

                {/* Album details*/}
                <Stack direction="row" spacing={0.5} alignItems="center" mt={1}>
                    <Disc3Icon
                        size={20}
                        strokeWidth={2}
                        color={theme.palette.text.secondary}
                    />
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            {item.album} ({item.year})
                        </Typography>
                    </Box>
                </Stack>

                {/* Genre chips */}
                <Stack direction="row" spacing={0.5} alignItems="center" mt={1}>
                    {item.genre
                        ?.split(/[,;]\s*/)
                        .filter((genre) => genre.length > 0)
                        .map((genre) => (
                            <Chip key={genre} label={genre} size="small" />
                        ))}
                </Stack>

                {/* Playback*/}
                <Box
                    sx={(theme) => ({
                        display: "flex",
                        flexDirection: "column",
                        gap: theme.spacing(1),
                        maxWidth: theme.breakpoints.values.laptop - 200,
                    })}
                    mt={1}
                >
                    <Stack direction="row" spacing={0.5} alignItems="center">
                        <ClockIcon
                            size={20}
                            strokeWidth={1.5}
                            color={theme.palette.text.secondary}
                        />
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "row",
                                justifyContent: "space-between",
                                width: "100%",
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {trackLengthRep(item.length, false)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Track {item.track} of {item.tracktotal}
                            </Typography>
                        </Box>
                    </Stack>
                    <AudioPlayerItem
                        itemId={item.id}
                        navigation={{
                            onNext: async () => {
                                await navigate({
                                    to: "/library/browse/$artist/$albumId/$itemId",
                                    params: {
                                        artist: item.albumartist,
                                        albumId: item.album_id,
                                        itemId: album.items[currentIdx + 1].id,
                                    },
                                });
                            },
                            onPrev: async () => {
                                await navigate({
                                    to: "/library/browse/$artist/$albumId/$itemId",
                                    params: {
                                        artist: item.albumartist,
                                        albumId: item.album_id,
                                        itemId: album.items[currentIdx - 1].id,
                                    },
                                });
                            },
                            prevDisabled: currentIdx === 0,
                            nextDisabled: currentIdx === album.items.length - 1,
                        }}
                    />
                </Box>
            </Box>
        </Box>
    );
}

/* --------------------------------- Details -------------------------------- */

function DetailsTabs({ item, ...props }: { item: ItemT<false> } & BoxProps) {
    const [tab, setTab] = useState<number>(0);

    return (
        <Box {...props}>
            <Box
                sx={(theme) => ({
                    borderBottom: `1px solid ${theme.palette.divider}`,
                })}
            >
                <Tabs
                    value={tab}
                    onChange={(_, newTab: number) => setTab(newTab)}
                    aria-label="item tabs"
                >
                    <Tab label="Identifier" />
                    <Tab label="Details" disabled />
                    <Tab label="File" disabled />
                    <Tab label="Advanced" />
                </Tabs>
            </Box>
            <TabPanel value={tab} index={0}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    All identifier and data source information for this item.
                </Typography>
                <Identifier item={item} />
            </TabPanel>
            <TabPanel value={tab} index={1} sx={{ overflow: "auto", height: "100%" }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Breakdown of all details from stored by beets for this item. Only
                    includes non-empty entries!
                </Typography>
                <BasicInfo item={item} />
            </TabPanel>
            <TabPanel value={tab} index={2}>
                <Typography variant="body2" color="text.secondary">
                    All id3 tags and file details of this item.
                </Typography>
            </TabPanel>
            <TabPanel value={tab} index={3}>
                <AdvancedTab item={item} />
            </TabPanel>
        </Box>
    );
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps & BoxProps) {
    const { children, value, index, ...other } = props;

    return (
        <Box
            role="tabpanel"
            hidden={value !== index}
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ paddingInline: 1, paddingTop: 2 }}>{children}</Box>
            )}
        </Box>
    );
}

/* ------------------------------- Basic Info ------------------------------- */

function BasicInfo({ item }: { item: ItemT<false> }) {
    //FIXME: Date parsing should happen on fetching!
    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell>Property</TableCell>
                    <TableCell>Value</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                <OptionalRow label="Composer" value={item.composer} />
                <OptionalRow label="Album Artist" value={item.albumartist} />
                <OptionalRow label="Label" value={item.label} />
                <OptionalRow label="Catalog #" value={item.catalognum} />
                <OptionalRow label="BPM (Beats per minute)" value={item.bpm} />
                <OptionalRow label="Key" value={item.initial_key} />
                <OptionalRow label="Bitrate" value={item.bitrate} />
                <OptionalRow
                    label="Added to Library"
                    value={new Date(item.added * 1000).toISOString()}
                />
            </TableBody>
        </Table>
    );
}

function OptionalRow({
    label,
    value,
    suffix = "",
    prefix = "",
}: {
    label: string;
    value?: number | string | null | Date;
    suffix?: string;
    prefix?: string;
}) {
    if (value === undefined || value === null || value === 0 || value === "") {
        return null;
    }

    return <Row property={label} value={prefix + value + suffix} />;
}

function Row({ property, value }: { property: string; value: string }) {
    return (
        <TableRow>
            <TableCell>{property}</TableCell>
            <TableCell>{value}</TableCell>
        </TableRow>
    );
}

/* ------------------------------- Identifier ------------------------------- */

/** The identifier tab
 *
 * FIXME: We should make some of these nested boxes a bit more reusable
 * and generic.
 */
function Identifier({ item }: { item: ItemT<false> }) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                // A bit of general styling for the labels
                label: {
                    color: "text.secondary",
                    fontSize: "0.8rem",
                },
                "a, span": {
                    fontFamily: "monospace",
                    marginLeft: 1,
                },
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "row",
                        gap: 1,
                        alignItems: "center",
                        fontWeight: "bold",
                    }}
                >
                    <StickyNoteIcon size={20} />
                    Common
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", px: 1 }}>
                    <label>path</label>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            gap: 1,
                            alignItems: "center",
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            marginLeft: 1,
                        }}
                    >
                        <div>{item.path}</div>
                        <ClipboardCopyButton
                            text={item.path}
                            sx={{ p: 0 }}
                            icon_props={{ size: 18 }}
                        />
                    </Box>
                    <label>beets id (of this item in your beets database)</label>
                    <span>{item.id}</span>
                </Box>
            </Box>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 0.5,
                    flexWrap: "wrap",
                }}
            >
                {item.sources.map((source) => (
                    <Box>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "row",
                                gap: 1,
                                alignItems: "center",
                                fontWeight: "bold",
                            }}
                        >
                            <SourceTypeIcon type={source.source} size={20} />
                            {sourceName(source)}
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "row",
                                gap: 0.5,
                                alignItems: "flex-start",
                                px: 1,
                            }}
                        >
                            <ItemSource key={source.track_id} source={source} />
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

/** Display the source of an item
 *
 * I.e. where the data for this item came from.
 *
 */
function ItemSource({ source }: { source: ItemSourceT }) {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                position: "relative",
                alignItems: "flex-start",
            }}
        >
            <label>track_id</label>
            <Link href={sourceHref(source.source, source.track_id, "track")}>
                {source.track_id}
            </Link>
            {source.artist_id && (
                <>
                    <label>artist_id</label>
                    <Link
                        href={sourceHref(source.source, source.artist_id, "artist")}
                        target="_blank"
                    >
                        {source.artist_id}
                    </Link>
                </>
            )}
            {source.album_id && (
                <>
                    <label>album_id</label>
                    <Link
                        href={sourceHref(source.source, source.album_id, "album")}
                        target="_blank"
                    >
                        {source.album_id}
                    </Link>
                </>
            )}
            {source.extra &&
                Object.entries(source.extra).map(([key, value]) => (
                    <Fragment key={key}>
                        <label>{key}</label>
                        {value instanceof Array ? (
                            value.map((v) => (
                                <Link
                                    key={v}
                                    href={sourceHref(
                                        source.source,
                                        v,
                                        key.replace(/_ids?/, "")
                                    )}
                                    target="_blank"
                                >
                                    {v}
                                </Link>
                            ))
                        ) : (
                            <Link
                                href={sourceHref(
                                    source.source,
                                    value,
                                    key.replace(/_ids?/, "")
                                )}
                                target="_blank"
                            >
                                {value}
                            </Link>
                        )}
                    </Fragment>
                ))}
        </Box>
    );
}

//TODO: move to common
function sourceHref<T extends string | string[]>(
    source: string,
    value: T,
    type: "track" | "artist" | "album" | "albumartist" | string = "track"
): T | undefined {
    let base: string | undefined = undefined;
    switch (source) {
        case "mb":
        case "musicbrainz":
            base = "https://musicbrainz.org";
            switch (type) {
                case "track":
                    base += "/recording";
                    break;
                case "artist":
                case "albumartist":
                    base += "/artist";
                    break;
                case "album":
                    base += "/release";
                    break;
                default:
                    console.warn(`Unknown type: ${type}`);
                    return undefined;
            }
            break;
        case "spotify":
            base = "https://open.spotify.com";
            switch (type) {
                case "track":
                    base += "/track";
                    break;
                case "artist":
                case "albumartist":
                    base += "/artist";
                    break;
                case "album":
                    base += "/album";
                    break;
                default:
                    console.warn(`Unknown type: ${type}`);
                    return undefined;
            }
            break;
        default:
            console.warn(`Unknown source: ${source}`);
            return undefined;
    }
    if (base === undefined) return undefined;

    if (value instanceof Array) {
        return value.map((v) => `${base}/${v}`) as T;
    }
    return `${base}/${value}` as T;
}

function sourceName(source: ItemSourceT): string {
    switch (source.source) {
        case "mb":
        case "musicbrainz":
            return "MusicBrainz";
        case "spotify":
            return "Spotify";
        default:
            return source.source;
    }
}

/* ------------------------------ Advanced Tab ------------------------------ */

// Todo this needs migration with the other list components (fixed top)
export function AdvancedTab({ item }: { item: ItemT<false> }) {
    const [filter, setFilter] = useState<string>("");

    // Create a flat list of all the properties
    const items = Object.entries(item).filter(([key]) => {
        if (key == "sources") return false;
        return true;
    });

    const filteredItems = useMemo(() => {
        return items.filter(
            ([key, value]) => key.includes(filter) || String(value).includes(filter)
        );
    }, [items, filter]);

    if (items.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary">
                No properties found.
            </Typography>
        );
    }

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 1,
                    alignItems: "flex-end",
                    justifyContent: "flex-end",
                    flexGrow: 1,
                    flexWrap: "wrap",
                }}
            >
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        alignSelf: "flex-start",
                        marginRight: "auto",
                    }}
                >
                    All properties of this item. This includes all values stored by
                    beets, omitting empty entries.
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        alignItems: "flex-end",
                    }}
                >
                    {filter.length > 0 && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                fontSize: "0.8rem",
                                marginLeft: "auto",
                                minWidth: "max-content !important",
                            }}
                        >
                            Excluded {items.length - filteredItems.length} properties
                        </Typography>
                    )}
                    <Search value={filter} setValue={setFilter} size="small" />
                </Box>
            </Box>
            <Table
                size="small"
                sx={{
                    //display: "grid",
                    width: "100%",
                    borderCollapse: "separate",
                    maxHeight: "400px",
                    height: "100%",
                    //tableLayout: "fixed",
                    td: {
                        //overflowWrap: "break-word",
                        maxHeight: "200px",
                        maxWidth: "100%",
                    },
                    position: "relative",
                    //thicker border bottom for head
                    thead: {
                        fontWeight: "bold",
                        fontSize: "0.95rem",
                        verticalAlign: "bottom",
                        top: 0,
                        position: "sticky",
                        th: { border: "unset" },
                        "> *:last-child > th": {
                            borderBottomWidth: 2,
                            borderBottomStyle: "solid",
                            borderBottomColor: "#515151",
                        },
                    },
                }}
            >
                <TableHead>
                    <TableRow>
                        <TableCell>Property</TableCell>
                        <TableCell>Value</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {filteredItems.map(([key, value]) => (
                        <TableRow key={key}>
                            <TableCell>{key}</TableCell>
                            <TableCell>{String(value)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    );
}

/* ---------------------------------- Utils --------------------------------- */

const ItemGrid = styled(Box)(({ theme }) => ({
    display: "grid",
    gridTemplateColumns: "[cover] 200px [info] 1fr",
    gridTemplateRows: "[title] min-content [details] auto",
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(1),

    padding: theme.spacing(1),
    overflow: "hidden",
    width: "100%",
    height: "100%",
    minHeight: 0,

    [theme.breakpoints.down("tablet")]: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
    },
}));
