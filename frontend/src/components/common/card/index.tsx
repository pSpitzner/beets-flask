import { Avatar, Box, styled } from "@mui/material";
import MuiCard from "@mui/material/Card";
import MuiCardContent from "@mui/material/CardContent";
import MuiCardActions from "@mui/material/CardActions";
import React from "react";

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
    justifyContent: "space-around",
    alignItems: "flex-start",
    rowGap: theme.spacing(4),
    position: "relative",
    overflow: "visible",
    height: "100%",
    paddingTop: theme.spacing(2),
}));

export const CardActions = styled(MuiCardActions)(({ theme }) => ({
    display: "flex",
    justifyContent: "space-between",
    rowGap: theme.spacing(4),
    width: "100%",
}));

export function CardAvatar({
    Icon,
    title,
    children,
}: {
    Icon: React.ElementType;
    title: string;
    children?: React.ReactNode;
}) {
    return (
        <div>
            <Avatar
                sx={{
                    width: 60,
                    height: 60,
                    margin: "auto",
                    backgroundColor: "transparent",
                    color: "primary.main",
                }}
                variant="rounded"
            >
                <Icon size="100%" />
            </Avatar>
            <Box
                component="h3"
                sx={{
                    fontSize: 18,
                    fontWeight: "bold",
                    letterSpacing: "0.5px",
                    marginTop: 1,
                    marginBottom: 0,
                }}
            >
                {title}
            </Box>
            {children}
        </div>
    );
}

export function CardTopInfo({ children }: { children?: React.ReactNode }) {
    return (
        <div className="absolute text-xs top-0 right-0 flex flex-row overflow-visible justify-center items-center p-2">
            {children}
        </div>
    );
}
