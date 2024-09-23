import { useEffect, useRef, useState } from "react";
import { CircularProgress, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import { createFileRoute } from "@tanstack/react-router";

import { AvailableSelections } from "@/components/import/candidateSelection";
import { ImportContextProvider, useImportContext } from "@/components/import/context";
import {
    ApplySelection,
    ImportTargetSelector,
} from "@/components/import/targetSelector";

export const Route = createFileRoute("/import/")({
    component: ImportPage,
});

function ImportPage() {
    const [importSessionKey, setImportSessionKey] = useState(0);

    // when the status changes (within the context) we want to remount
    // the context, but only after we have shown some information or
    // gave the user a chance to act.
    const handleNewSession = () => {
        setImportSessionKey((prevKey: number) => prevKey + 1);
    };

    return (
        <ImportContextProvider key={importSessionKey}>
            <Box sx={{ gap: "1rem", display: "flex", flexDirection: "column" }}>
                <ImportTargetSelector />
                <SessionsView handleNewSession={handleNewSession} />
            </Box>
        </ImportContextProvider>
    );
}

function SessionsView({ handleNewSession }: { handleNewSession: () => void }) {
    const { status } = useImportContext();
    const [timeoutId, setTimeoutId] = useState<number | undefined>(undefined);
    const statusText = useRef("");
    const [remainingPercent, setRemainingPercent] = useState<number>(0);

    useEffect(() => {
        if (
            timeoutId === undefined &&
            (status?.message === "completed" || status?.message === "aborted")
        ) {
            if (status?.message === "aborted") {
                statusText.current = "Import aborted!";
            }
            if (status?.message === "completed") {
                statusText.current = "Import completed!";
            }

            // construct a circular spinner as proxy for wait time
            // (todo: with an optional do-it-now button)
            const t = 3000;
            const dt = 1000;
            const dp = 100 / (t / dt);
            setRemainingPercent(0);
            const intervalId = setInterval(() => {
                setRemainingPercent((prev) => Math.min(100, prev + dp));
            }, dt);

            const tid = setTimeout(() => {
                handleNewSession();
                clearInterval(intervalId);
                // we want to show the last stage, so give a bit of grace
            }, t * 1.1);
            setTimeoutId(tid);
        }

        return () => {
            clearTimeout(timeoutId);
        };
    }, [status, timeoutId, handleNewSession]);

    // also check the status to avoid a flicker before the context is fully reset
    if (timeoutId !== undefined || status?.message === "completed") {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    width: "100%",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "1rem",
                    }}
                >
                    <Typography
                        variant="h6"
                        color={status?.message === "aborted" ? "error" : "primary"}
                    >
                        {statusText.current}
                    </Typography>
                    <Typography variant="body1">{"Returning to selection"}</Typography>
                </Box>
                <CircularProgress
                    color={status?.message === "aborted" ? "error" : "primary"}
                    variant="determinate"
                    value={remainingPercent}
                />
            </Box>
        );
    }

    return (
        <>
            <AvailableSelections />
            <ApplySelection />
        </>
    );
}
