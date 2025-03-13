import { IconButton, InputAdornment, TextField } from "@mui/material";
import { SearchIcon, XIcon } from "lucide-react";

/** Relative minimal search box */
export function Search({
    value,
    setValue,
    ...props
}: {
    value: string | null;
    setValue: (value: string | null) => void;
} & React.ComponentProps<typeof TextField>) {
    // Only shown if there is a value
    const endAdornment =
        value && value.length > 0 ? (
            <InputAdornment position="end">
                <IconButton
                    sx={{ padding: 0, color: "grey.500" }}
                    size="small"
                    disableRipple
                    onClick={() => setValue("")}
                >
                    <XIcon size={20} />
                </IconButton>
            </InputAdornment>
        ) : undefined;

    return (
        <TextField
            variant="outlined"
            slotProps={{
                input: {
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon color="gray" strokeWidth={1.5} size={20} />
                        </InputAdornment>
                    ),
                    endAdornment: endAdornment,
                },
            }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            {...props}
        />
    );
}
