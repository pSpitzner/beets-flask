import { PauseIcon, PlayIcon, PlusIcon } from "lucide-react";
import React from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Item, itemQueryOptions, ItemResponseFull } from "@/api/library";
import { JSONPretty } from "@/components/common/debugging/json";
import { formatDate, humanizeDuration } from "@/components/common/units/time";
import { useAudioContext } from "@/components/library/audio/context";

export const Route = createFileRoute("/library/(resources)/item/$itemId/")({
    component: RouteComponent,
});

function RouteComponent() {
    const params = Route.useParams();

    const { data: item } = useSuspenseQuery(itemQueryOptions(params.itemId, false));

    return (
        <Box
            sx={{
                padding: 2,
            }}
        >
            <AudioControls item={item} />
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 2,
                    marginTop: 2,
                }}
            >
                <GridItem
                    label="Duration"
                    description={humanizeDuration(item.length)}
                />
                <GridItem
                    label="Added"
                    description={formatDate(
                        new Date(item.added * 1000),
                        "%d. %B %Y %H:%M"
                    )}
                />
                <GridItem
                    label="Quality"
                    description={`${item.format} • ${Math.round(item.bitrate / 1000)} kbps`}
                />
                <GridItem
                    label="Sample Rate"
                    description={`${(item.samplerate / 1000).toFixed(1)} kHz`}
                />
                <GridItem label="Label" description={item.label} />
            </Box>
        </Box>
    );
}

function GridItem({
    label,
    description,
}: {
    label: string;
    description?: React.ReactNode;
}) {
    if (!description) {
        return null; // Skip rendering if description is not provided
    }
    return <_GridItem label={label} description={description} />;
}

function _GridItem({
    label,
    description,
}: {
    label: string;
    description: React.ReactNode;
}) {
    return (
        <Box>
            <Typography variant="body2" color="text.secondary" component="span">
                {label}
            </Typography>
            <Typography variant="body1">{description}</Typography>
        </Box>
    );
}

function AudioControls({ item }: { item: ItemResponseFull }) {
    const theme = useTheme();
    const { togglePlaying, currentItem, addToQueue, playing } = useAudioContext();

    const isCurrentItem = currentItem?.id === item.id;
    const isCurrentlyPlaying = isCurrentItem && playing;

    return (
        <Box
            sx={{
                display: "flex",
                gap: 2,
            }}
        >
            <Button
                startIcon={
                    isCurrentlyPlaying ? (
                        <PauseIcon size={theme.iconSize.lg} fill="currentColor" />
                    ) : (
                        <PlayIcon size={theme.iconSize.lg} fill="currentColor" />
                    )
                }
                variant="contained"
                size="large"
                onClick={() => {
                    if (isCurrentItem) {
                        togglePlaying();
                        return;
                    }

                    addToQueue(item, true, true);
                }}
            >
                {isCurrentlyPlaying ? "Pause" : "Play"}
            </Button>
            <Button
                startIcon={<PlusIcon size={theme.iconSize.lg} />}
                variant="outlined"
                size="large"
                onClick={() => addToQueue(item, false, false)}
            >
                Add to Queue
            </Button>
        </Box>
    );
}
