import { ClockIcon, Disc3Icon } from "lucide-react";
import { useState } from "react";
import {
    BoxProps,
    Chip,
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
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { albumQueryOptions, ItemFull } from "./_query";
import { AudioPlayerItem } from "./audio";
import CoverArt from "./coverArt";

/** A detailed view of an beets library item
 *
 */
export function Item({ item }: { item: ItemFull }) {
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

function ArtSection({ item, ...props }: { item: ItemFull } & BoxProps) {
    return (
        <Box {...props}>
            <CoverArt
                type="item"
                itemId={item.id}
                sx={{
                    width: "100%",
                    height: "auto",
                    objectFit: "cover",
                    borderRadius: 0,
                }}
            />
        </Box>
    );
}

function SongInfo({ item, ...props }: { item: ItemFull } & BoxProps) {
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
                    {item.title}
                </Typography>
                <Typography variant="h6" color="text.secondary" mt={0}>
                    {item.artist}
                </Typography>

                {/* Album details*/}
                <Stack direction="row" spacing={0.5} alignItems="center" mt={1}>
                    <Disc3Icon size={20} strokeWidth={2} color={theme.palette.text.secondary} />
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
                        .map((genre) => <Chip key={genre} label={genre} size="small" />)}
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
                                {formatTime(item.length)}
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

function DetailsTabs({ item, ...props }: { item: ItemFull } & BoxProps) {
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
                    <Tab label="Beets Details" />
                    <Tab label="File Details" />
                    {/* Future proof in case we need more content */}
                </Tabs>
            </Box>
            <TabPanel value={tab} index={0} sx={{ overflow: "auto", height: "100%" }}>
                <Typography variant="body2" color="text.secondary">
                    All fields of this item from your beets database.
                </Typography>
                <BasicInfo item={item} />
            </TabPanel>
            <TabPanel value={tab} index={1}>
                <Typography variant="body2" color="text.secondary">
                    All id3 tags and file details of this item.
                </Typography>
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
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </Box>
    );
}

/* ------------------------------- Basic Info ------------------------------- */

function BasicInfo({ item }: { item: ItemFull }) {
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

function formatTime(n: number | undefined): string {
    if (n === undefined) return "unk";
    const minutes = Math.floor(n / 60);
    const seconds = n % 60;
    return `${minutes}:${seconds.toFixed().padStart(2, "0")}`;
}
