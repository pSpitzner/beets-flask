import { ImportIcon } from "lucide-react";
import { Box, Button, Card, Divider, Typography } from "@mui/material";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { albumImportedOptions } from "@/api/library";
import { sessionQueryOptions } from "@/api/session";
import { JSONPretty } from "@/components/common/json";
import { relativeTime } from "@/components/common/units/time";
import { Progress, SerializedTaskState } from "@/pythonTypes";

import { CardHeader } from "./common";

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
            <Typography>
                {session.tasks.map((task) => (
                    <ImportedInfo key={task.id} task={task} />
                ))}
            </Typography>
            <Box>
                <Button variant="outlined" color="secondary">
                    Undo
                </Button>
            </Box>
        </Card>
    );
}

// Shows some information on the imported album
// using the beets library
function ImportedInfo({ task }: { task: SerializedTaskState }) {
    const { data: album } = useQuery(albumImportedOptions(task.id, true, true));

    if (!album) {
        return null;
    }

    return (
        <Box>
            <Typography variant="body2" fontFamily="monospace">
                <pre>{JSON.stringify(album, null, 2)}</pre>
            </Typography>
        </Box>
    );
}
