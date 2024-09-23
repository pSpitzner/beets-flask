import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Box, Button, FormHelperText } from "@mui/material";
import Tooltip from "@mui/material/Tooltip";

import { InboxPathSelector } from "../inbox/inboxPathSelector";
import { importStatusMessage, useImportContext } from "./context";

/** Selector allows to select a target folder for import
 */
export function ImportTargetSelector() {
    const { sessionPath, setSessionPath, status, selStates } = useImportContext();
    const [error, setError] = useState<string | null>(null);

    const currentPath = selStates?.[0]?.paths[0] ?? sessionPath;

    return (
        <div>
            <Box
                component="form"
                noValidate
                autoComplete="off"
                onSubmit={(e) => {
                    e.preventDefault();
                }}
                style={{
                    display: "flex",
                    gap: "1rem",
                    marginTop: "0.5rem",
                    flexWrap: "wrap",
                }}
            >
                <InboxPathSelector
                    value={currentPath}
                    onChange={(_e, v) => setSessionPath(v)}
                    sx={{ flexGrow: 1 }}
                    label="Select Path to Import"
                    disabled={selStates !== undefined}
                />
                <StartAndAbortBtn setError={setError} />
            </Box>
            <div
                style={{
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "space-between",
                }}
            >
                {status && (
                    <FormHelperText
                        style={{
                            marginInline: "1rem",
                        }}
                    >
                        Status: {importStatusMessage(status)}
                    </FormHelperText>
                )}
                {error && (
                    <FormHelperText
                        style={{
                            marginInline: "1rem",
                        }}
                        error={error?.length > 0}
                    >
                        {error}
                    </FormHelperText>
                )}
            </div>
        </div>
    );
}

function StartAndAbortBtn({
    setError,
}: {
    setError: Dispatch<SetStateAction<string | null>>;
}) {
    const { sessionPath, startSession, pending, status, abortSession } =
        useImportContext();

    function catchError(e: unknown) {
        if (e instanceof Error) {
            return e.message;
        } else if (typeof e === "string") {
            return e;
        } else {
            console.error(e);
            setError("Unknown error, see console for details");
        }

        setTimeout(() => {
            setError(null);
        }, 20000);
    }

    if (!status) {
        return (
            <Tooltip title="Start the import session">
                <Button
                    variant="outlined"
                    disabled={!sessionPath || pending}
                    onClick={() => {
                        startSession().catch(catchError);
                    }}
                >
                    Import
                </Button>
            </Tooltip>
        );
    } else {
        return (
            <Tooltip title="Abort the import session">
                <Button
                    variant="outlined"
                    color="warning"
                    onClick={() => {
                        abortSession().catch(catchError);
                    }}
                >
                    Abort
                </Button>
            </Tooltip>
        );
    }
}

export function ApplySelection() {
    const { completeAllSelections, selectionsInvalidCause } = useImportContext();
    const [tooltipText, setTooltipText] = useState<string | null>(null);

    useEffect(() => {
        if (selectionsInvalidCause === "no current candidate") {
            setTooltipText("Pick a candidate to apply changes!");
        } else if (selectionsInvalidCause === "no duplicate action") {
            setTooltipText("Choose what to do with the duplciate candidates!");
        } else {
            setTooltipText(selectionsInvalidCause);
        }
    }, [selectionsInvalidCause]);

    if (selectionsInvalidCause === "no selections") {
        // hide the apply button when the session has not started yet
        return null;
    }

    const inner = (
        // Wrap into a Box to enable Tooltips on disabled buttons
        <Box>
            <Button
                variant="outlined"
                color="primary"
                onClick={completeAllSelections}
                disabled={selectionsInvalidCause !== null}
                sx={{ width: "100%" }}
            >
                Apply
            </Button>
        </Box>
    );

    if (tooltipText) {
        return <Tooltip title={tooltipText}>{inner}</Tooltip>;
    } else {
        return inner;
    }
}
