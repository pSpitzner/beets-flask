import { ImportIcon } from "lucide-react";
import { Card, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { sessionQueryOptions } from "@/api/session";
import { relativeTime } from "@/components/common/units/time";
import { Progress } from "@/pythonTypes";

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
            <Typography>
                TODO: Show beet ids of all tasks and a reference to our library. Also
                allow to undo an import here.
            </Typography>
        </Card>
    );
}
