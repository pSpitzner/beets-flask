import { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import { useQuery } from "@tanstack/react-query";

import { inboxPathsQueryOptions } from "../common/_query";

/** An autocomplete component which can be used to select a folder or file path.
 *
 * Is mainly an mui autocomplete component
 *
 */
export function InboxPathSelector({
    show_depth = 3,
    ...props
}: {
    show_depth?: number;
} & Omit<
    React.ComponentProps<typeof Autocomplete<string>>,
    | "open"
    | "onOpen"
    | "onClose"
    | "inputValue"
    | "onInputChange"
    | "filterOptions"
    | "options"
    | "renderInput"
>) {
    // Load all file paths
    const {
        data: paths,
        isLoading,
        isError,
        error,
    } = useQuery(inboxPathsQueryOptions());

    // Selected value
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState<string>("");

    function handleOpen() {
        setOpen(true);
    }

    function handleClose() {
        setOpen(false);
    }

    useEffect(() => {
        console.log(inputValue);
    }, [inputValue]);

    const filteredPaths = useMemo(() => {
        if (!paths) return [];
        return paths.filter((path) => {
            const optionDepth = path.includes("/") ? path.split("/").length : 0;
            const inputDepth = inputValue.includes("/")
                ? inputValue.split("/").length
                : 1;
            return optionDepth <= inputDepth + show_depth;
        });
    }, [inputValue, paths, show_depth]);

    return (
        <Autocomplete
            open={open}
            onOpen={handleOpen}
            onClose={handleClose}
            inputValue={inputValue}
            onInputChange={(_e, value) => setInputValue(value)}
            filterOptions={(x) => x}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="Enter Path"
                    slotProps={{
                        // Loading indicator if values are currently updated
                        input: {
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {isLoading ? (
                                        <CircularProgress color="inherit" size={20} />
                                    ) : null}
                                </>
                            ),
                        },
                    }}
                    variant="standard"
                    error={isError}
                    helperText={isError ? error.message : null}
                />
            )}
            options={filteredPaths}
            {...props}
        />
    );
}
