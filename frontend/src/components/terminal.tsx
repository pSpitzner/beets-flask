import React, { useState } from "react";
import { Slide, Button, Box, Portal, IconButton } from "@mui/material";
import { ChevronDown, Terminal as TerminalIcon } from "lucide-react";

const SlideIn = ({ children }: { children: React.ReactNode }) => {
    const [isVisible, setIsVisible] = useState(false);

    const toggleSlide = () => {
        setIsVisible(!isVisible);
    };

    return (
        <Portal container={document.getElementById("app")}>
            <Box sx={{ position: "fixed", bottom: 0, width: "100%" }}>
                <Slide direction="up" in={isVisible}>
                    <Box
                        sx={{
                            position: "fixed",
                            width: "100vw",
                            boxShadow: 3,
                            bottom: 0,
                            zIndex: 1000,
                            display: "flex",
                            flexDirection: "column",
                            minHeight: "10vh",
                        }}
                    >
                        <div className="flex justify-end gap-4 flex-row w-100 mr-4">
                            <IconButton
                                onClick={toggleSlide}
                                color="primary"
                                size="small"
                                sx={{
                                    backgroundColor: "black",
                                    color: "primary.dark",
                                    borderColor: "primary.dark",
                                    borderRadius: "0.5rem",
                                    border: "2px solid",
                                    borderBottomLeftRadius: "0rem",
                                    borderBottomRightRadius: "0rem",
                                    borderBottom: "0px",

                                    ":hover": {
                                        borderBottom: "0px",
                                        borderColor: "primary.dark",
                                    },
                                }}
                            >
                                <ChevronDown size={14} />
                            </IconButton>
                        </div>
                        <Box
                            className="flex flex-col p-4 border-t-2w-100 h-100 flex-grow"
                            sx={{
                                borderTop: "2px solid",
                                borderColor: "primary.dark",
                                backgroundColor: "black",
                                color: "primary.main",
                                fontFamily: "monospace",
                                fontSize: "0.8rem",
                            }}
                        >
                            {children}
                        </Box>
                    </Box>
                </Slide>
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={toggleSlide}
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        margin: "0.5rem",
                        width: "100xp",
                        fontSize: "0.8rem",
                        fontFamily: "monospace",
                        padding: "0.2rem 0.5rem",
                    }}
                    startIcon={<TerminalIcon size={14} className="ml-2" />}
                >
                    Terminal
                </Button>
            </Box>
        </Portal>
    );
};

export function Terminal() {
    return <SlideIn>Content goes here!</SlideIn>;
}
