import CircularProgress from "@mui/material/CircularProgress";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function LoadingIndicator() {
    return (
        <Box
            className="loading-indicator"
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                justifyContent: "center",
                alignItems: "center",
                margin: "auto",
            }}
        >
            <CircularProgress />
            <Typography>Loading ...</Typography>
        </Box>
    );
}
