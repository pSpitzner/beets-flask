import { SearchIcon, XIcon } from "lucide-react";
import { IconButton, InputAdornment, TextField } from "@mui/material";

/** Relative minimal search box */
export function Search({
    value,
    setValue,
    ...props
}: {
    value: string;
    setValue: (value: string) => void;
} & React.ComponentProps<typeof TextField>) {
    // Only shown if there is a value
    const endAdornment = (
        <InputAdornment position="end">
            <IconButton
                sx={{ padding: 0, color: "grey.500", minWidth: 20 }}
                disableRipple
                onClick={() => setValue("")}
            >
                {value && value.length > 0 ? <XIcon size={20} /> : null}
            </IconButton>
        </InputAdornment>
    );

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
