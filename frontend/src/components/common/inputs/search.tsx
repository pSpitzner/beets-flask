import { SearchIcon, XIcon } from "lucide-react";
import {
    CircularProgress,
    IconButton,
    InputAdornment,
    TextField,
    useTheme,
} from "@mui/material";

/** Relative minimal search box */
export function Search({
    value,
    setValue,
    loading = false,
    ...props
}: {
    value: string;
    loading?: boolean;
    setValue: (value: string) => void;
} & React.ComponentProps<typeof TextField>) {
    const theme = useTheme();
    // Only shown if there is a value
    const endAdornment = (
        <InputAdornment position="end">
            {loading ? (
                <CircularProgress size={theme.iconSize.md} />
            ) : (
                <IconButton
                    sx={{ padding: 0, color: "grey.500", minWidth: theme.iconSize.md }}
                    disableRipple
                    onClick={() => setValue("")}
                >
                    {value && value.length > 0 ? (
                        <XIcon size={theme.iconSize.md} />
                    ) : null}
                </IconButton>
            )}
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
