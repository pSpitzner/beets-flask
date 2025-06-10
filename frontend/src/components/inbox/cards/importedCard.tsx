import { ImportIcon } from "lucide-react";
import {
    Alert,
    AlertProps,
    AlertTitle,
    Box,
    Button,
    Card,
    Divider,
    Skeleton,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";

import { APIError } from "@/api/common";
import { albumImportedOptions } from "@/api/library";
import { enqueueMutationOptions, sessionQueryOptions } from "@/api/session";
import { BackButton } from "@/components/common/inputs/back";
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
            />
            <Divider />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {session.tasks.map((task) => (
                    <ImportedTaskInfo key={task.id} task={task} />
                ))}
            </Box>
            <Box display="flex" gap={2}>
                <BackButton variant="outlined" color="secondary" size="medium" />
                <Button
                    variant="outlined"
                    color="secondary"
                    loading={isPending}
                    sx={{ ml: "auto" }}
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
    const {
        data: album,
        error,
        isPending,
    } = useQuery(albumImportedOptions(task.id, true, true));

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

    return (
        <Box>
            {isPending && (
                <Skeleton
                    variant="rectangular"
                    width="100%"
                    height={100}
                    sx={{
                        borderRadius: 1,
                    }}
                />
            )}
            {task.duplicate_action}
            {album && <AlbumInfo album={album} />}
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
