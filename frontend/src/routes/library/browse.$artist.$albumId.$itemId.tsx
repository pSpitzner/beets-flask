import { itemQueryOptions } from "@/lib/library";
import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import styles from "./browse.module.scss";
import ItemDetailsTableView from "@/components/common/itemDetailsTable";
import { useState } from "react";
import { Bug as BugOn, BugOff } from "lucide-react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { Paper } from "@mui/material";

export const Route = createFileRoute("/library/browse/$artist/$albumId/$itemId")({
    parseParams: (params) => ({
        itemId: z.number().int().parse(parseInt(params.itemId)),
    }),
    loader: (opts) =>
        opts.context.queryClient.ensureQueryData(
            itemQueryOptions({
                id: opts.params.itemId,
                minimal: false,
                expand: true,
            })
        ),
    component: TrackView,
});

function TrackView() {
    const item = Route.useLoaderData();
    const [detailed, setDetailed] = useState(false);

    return (
        <>
            <Paper className={styles.listBox + " " + styles.trackViewBox}>
                <Tooltip title="Toggle Details" className="ml-auto mt-1">
                    <IconButton color="primary" onClick={() => setDetailed(!detailed)}>
                        {detailed && <BugOff size="1em" />}
                        {!detailed && <BugOn size="1em" />}
                    </IconButton>
                </Tooltip>

                <ItemDetailsTableView item={item} keys={detailed ? "all" : "basic"} />
            </Paper>
        </>
    );
}
