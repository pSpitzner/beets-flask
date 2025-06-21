import { EyeIcon, PencilIcon } from "lucide-react";
import { Box, Typography, useTheme } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import { SplitButtonOptions } from "@/components/common/inputs/splitButton";
import { PageWrapper } from "@/components/common/page";

export const Route = createFileRoute("/debug/design/buttons")({
    component: RouteComponent,
});

function RouteComponent() {
    const theme = useTheme();
    return (
        <PageWrapper sx={{ gap: "1rem", display: "flex", flexDirection: "column" }}>
            <Box>
                <Typography
                    variant="h1"
                    gutterBottom
                    sx={{ textAlign: "center", fontSize: "2rem", fontWeight: "bold" }}
                >
                    Buttons
                </Typography>
                <Typography variant="body1">
                    This page was used to design and test button styles. It contains
                    various button styles and their states. It is mainly used for
                    testing and debugging purposes.
                </Typography>
            </Box>
            <Box>
                <Typography
                    variant="h2"
                    gutterBottom
                    sx={{ fontSize: "1.5rem", fontWeight: "bold" }}
                >
                    Button with dropdown menu
                </Typography>
                <Typography variant="body1">
                    A multi state button with a dropdown menu. It can be used to select
                    different actions for the button. Used in inbox.
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        marginTop: "1rem",
                        gap: "1rem",
                    }}
                >
                    <SplitButtonOptions
                        options={[
                            {
                                label: "Action 1",
                                key: "action1",
                                buttonProps: {
                                    startIcon: <PencilIcon size={theme.iconSize.md} />,
                                },
                            },
                            {
                                label: "Action 2",
                                key: "action2",
                                buttonProps: {
                                    startIcon: <EyeIcon size={theme.iconSize.md} />,
                                },
                            },
                            { label: "Action 3", key: "action3" },
                        ]}
                        onClick={(option, _evt) => {
                            alert(`Clicked on ${option.label}`);
                        }}
                    />
                    <SplitButtonOptions
                        color="secondary"
                        options={[
                            {
                                label: "Action 1",
                                key: "action1",
                                buttonProps: {
                                    startIcon: <PencilIcon size={theme.iconSize.md} />,
                                },
                            },
                            {
                                label: "Action 2",
                                key: "action2",
                                buttonProps: {
                                    startIcon: <EyeIcon size={theme.iconSize.md} />,
                                },
                            },
                            { label: "Action 3", key: "action3" },
                        ]}
                        onClick={(option, evt) => {
                            alert(`Clicked on ${option.label}`);
                        }}
                    />
                </Box>
            </Box>
        </PageWrapper>
    );
}
