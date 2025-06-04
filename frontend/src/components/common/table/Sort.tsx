import { ArrowDownAZIcon, ArrowDownZAIcon } from "lucide-react";
import { useMemo } from "react";
import {
    Box,
    BoxProps,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    useTheme,
} from "@mui/material";

export interface SortItem {
    label: string;
    value: string;
}

export interface CurrentSort {
    value: string;
    direction: "ASC" | "DESC";
}

export interface SortToggleProps extends BoxProps {
    value: CurrentSort | undefined;
    setValue: (s: CurrentSort) => void;
    items: SortItem[];
}

/**
 * SortToggle component allows users to select a sorting option
 * allows to select a key and toggle the sorting direction.
 */
export function SortToggle({ value, setValue, items, sx, ...props }: SortToggleProps) {
    const theme = useTheme();

    const currentSort = useMemo(() => {
        return items.find((item) => item.value === value?.value);
    }, [items, value]);

    return (
        <Box
            sx={[
                {
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    width: "100%",
                    minWidth: "180px",
                    maxWidth: "200px",
                },
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...props}
        >
            <FormControl size="small" fullWidth sx={{ height: "100%" }}>
                <InputLabel id="demo-simple-select-label">Sort by</InputLabel>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={currentSort?.value || ""}
                    label="Sort by"
                    onChange={(event) => {
                        const selectedValue = event.target.value;
                        const selectedItem = items.find(
                            (item) => item.value === selectedValue
                        );
                        if (selectedItem) {
                            setValue({
                                direction: value?.direction || "ASC",
                                value: selectedItem.value,
                            });
                        }
                    }}
                    sx={{ height: "100%" }}
                >
                    {items.map((item) => (
                        <MenuItem
                            key={item.value}
                            value={item.value}
                            sx={{
                                fontSize: "1rem",
                            }}
                        >
                            {item.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Button
                variant="outlined"
                sx={{
                    minWidth: "unset",
                    aspectRatio: "1/1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 0,
                    m: 0,
                    height: "100%",
                }}
                onClick={() => {
                    setValue({
                        value: value?.value || items[0].value,
                        direction: value?.direction === "ASC" ? "DESC" : "ASC",
                    });
                }}
            >
                {value?.direction === "ASC" ? (
                    <ArrowDownAZIcon size={theme.iconSize.md} />
                ) : (
                    <ArrowDownZAIcon size={theme.iconSize.md} />
                )}
            </Button>
        </Box>
    );
}
