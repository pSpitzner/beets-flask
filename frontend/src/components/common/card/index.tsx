import { styled } from "@mui/material";
import MuiCard from "@mui/material/Card";
import MuiCardContent from "@mui/material/CardContent";
import MuiCardActions from "@mui/material/CardActions";

export const Card = styled(MuiCard)(() => ({
    borderRadius: "12px",
    minWidth: 256,
    textAlign: "center",
    boxShadow: "0 2px 4px -2px rgba(0,0,0,0.24), 0 4px 24px -2px rgba(0, 0, 0, 0.2)",
    overflow: "visible",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "space-between",
    justifyContent: "space-between",
}));

export const CardContent = styled(MuiCardContent)(({ theme }) => ({
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    rowGap: theme.spacing(4),
    position: "relative",
    overflow: "visible",
}));

export const CardActions = styled(MuiCardActions)(({ theme }) => ({
    display: "flex",
    justifyContent: "space-between",
    rowGap: theme.spacing(4),
    width: "100%",
}));
