import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { itemSearchQueryOptions } from "@/components/common/_query";
import { JSONPretty } from "@/components/common/json";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import ToggleButton from "@mui/material/ToggleButton";

export const Route = createFileRoute("/library/search")({
    component: SearchPage,
});

function SearchPage() {
    const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
    const [searchKind, setSearchKind] = useState("item");
    const [triggerSearch, setTriggerSearch] = useState(false);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const searchTerm = e.target.value ?? undefined;
        setSearchTerm(searchTerm);
    };

    const handleKindChange = (_e: React.MouseEvent<HTMLElement>, newKind: string) => {
        setSearchKind(newKind);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            setTriggerSearch(true);
        }
    };

    const { data } = useQuery(itemSearchQueryOptions({ searchFor: searchTerm }), {
        enabled: triggerSearch,
        onSuccess: () => setTriggerSearch(false),
    });

    console.log(data);

    return (
        <>
            <Box
                component="form"
                noValidate
                autoComplete="off"
                sx={{
                    display: "flex",
                    flexDirection: "row",
                }}
            >
                <TextField
                    sx={{ width: "100%", marginRight: "0.5rem" }}
                    id="search_field"
                    label={`Search ${searchKind}s`}
                    variant="outlined"
                    type="search"
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                />

                <ToggleButtonGroup
                    color="primary"
                    value={searchKind}
                    exclusive
                    onChange={handleKindChange}
                    aria-label="Platform"
                >
                    <ToggleButton value="item">Item</ToggleButton>
                    <ToggleButton value="album">Album</ToggleButton>
                </ToggleButtonGroup>
            </Box>
            <Box>
                <JSONPretty data={data} />
            </Box>
        </>
    );
}
