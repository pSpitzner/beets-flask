import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { createFileRoute, useSearch } from "@tanstack/react-router";

import { ImportContextProvider, useImportContext } from "@/components/import/context";
import { Selections } from "@/components/import/selection";
import { InboxPathSelector } from "@/components/inbox/inboxPathSelector";

export const Route = createFileRoute("/import/")({
    component: () => (
        <div>
            <ImportContextProvider>
                <ImportPage />
            </ImportContextProvider>
        </div>
    ),
});

interface SearchParams {
    sessionPath?: string;
}

function ImportPage() {
    const {
        completeAllSelections,
        sessionPath,
        setSessionPath,
        startSession,
        allSelectionsValid,
        status,
    } = useImportContext();

    const search: SearchParams = useSearch({ from: "/import/" });
    const isUpdatingRef = useRef(false); // avoid feedback loop

    useEffect(() => {
        if (search.sessionPath) {
            setSessionPath(decodeURIComponent(search.sessionPath));
        }
        isUpdatingRef.current = false;
    }, [search.sessionPath, setSessionPath]);

    const updateSessionPath = (path: string | null) => {
        setSessionPath(path);
        const url = new URL(window.location.href);
        if (path) {
            url.searchParams.set("sessionPath", encodeURIComponent(path));
        } else {
            url.searchParams.delete("sessionPath");
        }
        isUpdatingRef.current = true;
        window.history.pushState({}, "", url);
    };

    return (
        <div>
            <Selections />

            <Box
                sx={{
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "flex-start",
                    alignItems: "flex-start",
                    flexDirection: "column",
                }}
            >
                <div className="flex gap-2 w-100">
                    <InboxPathSelector
                        value={sessionPath}
                        onChange={(_e, v) => updateSessionPath(v)}
                        style={{ width: "500px" }}
                    />

                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={() => {
                            if (sessionPath) startSession();
                        }}
                    >
                        (Re-)Start Session
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outlined"
                        color="primary"
                        onClick={completeAllSelections}
                        disabled={!allSelectionsValid}
                    >
                        Apply
                    </Button>
                    <Button variant="outlined" color="warning">
                        Abort
                    </Button>
                </div>
                <Typography>Status: {status}</Typography>
            </Box>
        </div>
    );
}
