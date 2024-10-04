import Box from "@mui/material/Box";

import { Terminal } from "@/components/frontpage/terminal";


export default function ToolBar() {

    return (
        <Box sx={{
            display: "flex",
            justifyContent: "flex-end",
        }}>
        <Terminal/>
        </Box>
    );
}