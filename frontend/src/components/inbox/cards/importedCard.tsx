import { ImportIcon, LibraryIcon, UndoIcon } from "lucide-react";
import {
    Alert,
    AlertProps,
    AlertTitle,
    Box,
    Button,
    Card,
    Divider,
    Skeleton,
    Typography,
    useTheme,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { APIError } from "@/api/common";
import { albumImportedOptions } from "@/api/library";
import { enqueueMutationOptions, sessionQueryOptions } from "@/api/session";
import { humanizeBytes } from "@/components/common/units/bytes";
import { relativeTime } from "@/components/common/units/time";
import { useStatusSocket } from "@/components/common/websocket/status";
import {
    AlbumResponseMinimalExpanded,
    EnqueueKind,
    Progress,
    SerializedCandidateState,
    SerializedTaskState,
} from "@/pythonTypes";

import { CardHeader } from "./common";
import { Code } from "./folderCard";

export function ImportedCard({
    folderHash,
    folderPath,
}: {
    folderHash: string;
    folderPath: string;
}) {
    const theme = useTheme();
    const { data: session } = useQuery(
        sessionQueryOptions({
            folderPath,
            folderHash,
        })
    );

    const { socket } = useStatusSocket();
    const { mutate, isPending } = useMutation(enqueueMutationOptions);

    if (!session || session.status.progress < Progress.IMPORT_COMPLETED) {
        return null;
    }

    return (
        <Card
            sx={{
                display: "flex",
                gap: 2,
                flexDirection: "column",
                padding: 2,
            }}
        >
            <CardHeader
                icon={<ImportIcon />}
                title="Imported into beets library"
                // FIXME: Timezones seem broken, at least for me it is 2 hours off
                subtitle={"Imported " + relativeTime(session.updated_at)}
            >
                <Box sx={{ ml: "auto", alignSelf: "flex-start" }}>
                    {session.tasks.length > 1 && (
                        <Typography variant="caption" component="div" textAlign="right">
                            {session.tasks.length} tasks completed
                        </Typography>
                    )}
                </Box>
            </CardHeader>
            <Divider />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {session.tasks.map((task) => (
                    <ImportedTaskInfo key={task.id} task={task} />
                ))}
            </Box>
            <Box display="flex" gap={2}>
                <Button
                    variant="outlined"
                    color="secondary"
                    loading={isPending}
                    onClick={() => {
                        mutate({
                            socket,
                            selected: {
                                hashes: [folderHash],
                                paths: [folderPath],
                            },
                            kind: EnqueueKind.IMPORT_UNDO,
                            delete_files: true,
                        });
                    }}
                    startIcon={<UndoIcon size={theme.iconSize.md} />}
                >
                    Undo Import
                </Button>
            </Box>
        </Card>
    );
}

// Shows some information on the imported album
// using the beets library
function ImportedTaskInfo({ task }: { task: SerializedTaskState }) {
    const theme = useTheme();
    const {
        data: album,
        error,
        isPending,
    } = useQuery(albumImportedOptions(task.id, true, false));

    const chosenCandidate = task.candidates.find(
        (c) => c.id === task.chosen_candidate_id
    );

    if (error && error instanceof APIError && error.statusCode === 404) {
        return (
            <Box>
                <NotFoundWarning chosenCandidate={chosenCandidate} />
            </Box>
        );
    } else if (error) {
        throw error;
    }

    if (isPending) {
        return (
            <Box>
                <Skeleton
                    variant="rectangular"
                    width="100%"
                    height={100}
                    sx={{
                        borderRadius: 1,
                    }}
                />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: "flex",
                gap: 1,
                width: "100%",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    flexGrow: 1,
                    flexWrap: "wrap",
                    columnGap: 1,
                    label: {
                        color: "text.secondary",
                    },
                }}
            >
                <Typography variant="h6" component="div" sx={{ width: "100%" }}>
                    {album.albumartist} - {album.name}
                </Typography>
                <Box>
                    <Typography variant="body2" component="label">
                        Source:
                    </Typography>
                    <Typography variant="body1" component="div" ml={1}>
                        {task.toppath || task.paths.join(", ")}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="body2" component="label">
                        Destination:
                    </Typography>
                    <Typography variant="body1" component="div" ml={1}>
                        {album.items.at(0)?.path.split("/").slice(0, -1).join("/")}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="body2" component="label">
                        Operation:
                    </Typography>
                    <Typography variant="body1" component="div" ml={1}>
                        {/* TODO: Hardcoded for now, should be dynamic */}
                        COPY
                    </Typography>
                </Box>
            </Box>
            <Box sx={{ flexGrow: "0 1", ml: "auto", mt: "auto" }}>
                <Link
                    to="/library/album/$albumId"
                    params={{ albumId: album.id }}
                    style={{ textDecoration: "none", height: "100%" }}
                >
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<LibraryIcon size={theme.iconSize.md} />}
                    >
                        View Album
                    </Button>
                </Link>
            </Box>
        </Box>
    );
}

function AlbumInfo({ album }: { album: AlbumResponseMinimalExpanded }) {
    return (
        <Box>
            <Box component="ul" sx={{ m: 0 }}>
                <li>
                    size:{" "}
                    {humanizeBytes(
                        album.items.reduce((acc, item) => acc + item.size, 0)
                    )}
                </li>
                <li>Beets id: {album.id}</li>
            </Box>
        </Box>
    );
}

function NotFoundWarning({
    chosenCandidate,
    ...props
}: {
    chosenCandidate?: SerializedCandidateState;
} & AlertProps) {
    return (
        <Alert
            severity="warning"
            sx={{
                ".MuiAlert-message": { width: "100%" },
            }}
            {...props}
        >
            <AlertTitle>Album not found in beets library</AlertTitle>
            <Box>
                Seems like the imported album{" "}
                <Code>
                    {chosenCandidate?.info.artist || "?"} -{" "}
                    {chosenCandidate?.info.album || "?"}
                </Code>{" "}
                is not found in your beets library. This may indicate that the album was
                not imported correctly or that it was removed from your library after
                importing!
            </Box>
        </Alert>
    );
}
