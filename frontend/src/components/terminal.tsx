import React, { createContext, useEffect, useRef, useState } from "react";
import { Slide, Button, Box, Portal, IconButton } from "@mui/material";
import { ChevronDown, Terminal as TerminalIcon } from "lucide-react";

import "node_modules/@xterm/xterm/css/xterm.css"
import {Terminal as xTerminal} from "@xterm/xterm"
import styles from "./terminal.module.scss";
import { socket, useSocket } from "@/lib/socket";

const SlideIn = ({ children }: { children: React.ReactNode }) => {

    const { open, toggle } = useTerminalContext();

    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }
    }, [open]);

    return (
        <Portal container={document.getElementById("app")}>
            <Box className={styles.slideIn}>
                <Slide direction="up" in={open}>
                    <Box
                    >
                        <div className="flex justify-end gap-4 flex-row w-100 mr-4">
                            <IconButton
                                onClick={toggle}
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
                    onClick={toggle}
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        margin: "0.5rem",
                        width: "100xp",
                        fontSize: "0.8rem",
                        fontFamily: "monospace",
                        padding: "0.2rem 0.5rem",
                        zIndex: -1,
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
    return <SlideIn><XTermBinding/></SlideIn>;
}


function XTermBinding(){

    const {socket, isConnected} = useSocket();

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current || !isConnected) return;

        const term = new xTerminal({
            cursorBlink: true,
        macOptionIsMeta: true,
        });

        // Handle copy and paste events
        function customKeyEventHandler(e : KeyboardEvent) {
            if (e.type !== "keydown") {
            return true;
            }
            if (e.ctrlKey && e.shiftKey) {
            const key = e.key.toLowerCase();
            if (key === "v") {
                // ctrl+shift+v: paste whatever is in the clipboard
                navigator.clipboard.readText().then((toPaste) => {
                term.write(toPaste);
                });
                return false;
            } else if (key === "c" || key === "x") {
                // ctrl+shift+x: copy whatever is highlighted to clipboard

                // 'x' is used as an alternate to 'c' because ctrl+c is taken
                // by the terminal (SIGINT) and ctrl+shift+c is taken by the browser
                // (open devtools).
                // I'm not aware of ctrl+shift+x being used by anything in the terminal
                // or browser
                const toCopy = term.getSelection();
                navigator.clipboard.writeText(toCopy);
                term.focus();
                return false;
            }
            }
            return true;
        }

        term.attachCustomKeyEventHandler(customKeyEventHandler);

        term.open(ref.current);
        term.write("Hello from \x1B[1;3;31mxterm.js\x1B[0m $ ");

        /** Attatch handler for input
         */
        term.onData((data) => {
            console.log("browser terminal received new data:", data);
            socket.emit("ptyInput", { input: data });
        });

        function onOutput(data: {output:string}) {
            console.log("browser terminal received new output:", data)
            term.write(data.output);
        }
        socket.on("ptyOutput", onOutput);

        return () => {
            term.dispose();
            socket.off("ptyOutput", onOutput);
        }
    }, [isConnected]);


    return <div ref={ref}></div>
}





export interface TerminalContextI {
    open: boolean;
    toggle: () => void;
    onInput: (input: string) => void;
    output: string[];
}

const TerminalContext = createContext<TerminalContextI>({
    open: false,
    toggle: () => {},
    onInput: () => {},
    output: [],
});

export function TerminalContextProvider({children}: {children: React.ReactNode}){
    const [open, setOpen] = useState(false);
    const [output, setOutput] = useState<string[]>([]);

    const terminalState : TerminalContextI = {
        open,
        toggle: () => setOpen(!open),
        onInput: (input: string) => {
            console.log(input);
        },
        output,
    };

    return (
        <TerminalContext.Provider value={terminalState}>
            {children}
        </TerminalContext.Provider>
    );
}


export function useTerminalContext(){
    return React.useContext(TerminalContext);
}
