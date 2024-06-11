import React, { Dispatch, SetStateAction, createContext, useEffect, useRef, useState } from "react";
import { Slide, Button, Box, Portal, IconButton } from "@mui/material";
import { ChevronDown, Terminal as TerminalIcon } from "lucide-react";

import "node_modules/@xterm/xterm/css/xterm.css";
import { Terminal as xTerminal } from "@xterm/xterm";
import styles from "./terminal.module.scss";
import { useSocket } from "@/lib/socket";
import { Socket } from "socket.io-client";

const SlideIn = ({ children }: { children: React.ReactNode }) => {
    const { open, toggle } = useTerminalContext();

    // prevent scrolling of main content when terminal is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }
    }, [open]);

    return (
        <Portal container={document.getElementById("app")}>
            <div className={styles.slideIn}>
                <Slide direction="up" in={open}>
                    <div>
                        <div className={styles.slideInHeader}>
                            <IconButton
                                onClick={toggle}
                                color="primary"
                                size="small"
                                className={styles.terminalCollapseButton}
                            >
                                <ChevronDown size={14} />
                            </IconButton>
                        </div>
                        <div className={styles.terminalContent}>{children}</div>
                    </div>
                </Slide>
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={toggle}
                    className={styles.terminalExpandButton}
                    startIcon={<TerminalIcon size={14} className="ml-2" />}
                >
                    Terminal
                </Button>
            </div>
        </Portal>
    );
};

export function Terminal() {
    return (
        <SlideIn>
            <XTermBinding />
        </SlideIn>
    );
}

function XTermBinding() {
    const ref = useRef<HTMLDivElement>(null);

    const { gui } = useTerminalContext();

    useEffect(() => {
        if (!ref.current || !gui) return;

        // Handle copy and paste events
        function customKeyEventHandler(e: KeyboardEvent) {
            if (!gui) return false;

            if (e.type !== "keydown") return true;

            if (e.ctrlKey && e.shiftKey) {
                const key = e.key.toLowerCase();
                if (key === "v") {
                    // ctrl+shift+v: paste whatever is in the clipboard
                    navigator.clipboard.readText().then((toPaste) => {
                        gui.write(toPaste);
                    });
                    return false;
                } else if (key === "c" || key === "x") {
                    // ctrl+shift+x: copy whatever is highlighted to clipboard

                    // 'x' is used as an alternate to 'c' because ctrl+c is taken
                    // by the terminal (SIGINT) and ctrl+shift+c is taken by the browser
                    // (open devtools).
                    // I'm not aware of ctrl+shift+x being used by anything in the terminal
                    // or browser
                    const toCopy = gui.getSelection();
                    navigator.clipboard.writeText(toCopy);
                    gui.focus();
                    return false;
                }
            }
            return true;
        }

        gui.attachCustomKeyEventHandler(customKeyEventHandler);

        gui.open(ref.current);

        return () => {
            gui.dispose();
        };
    }, [gui]);

    return <div ref={ref}></div>;
}

export interface TerminalContextI {
    open: boolean;
    toggle: () => void;
    setOpen: Dispatch<SetStateAction<boolean>>;
    inputText: (input: string) => void;
    socket?: Socket;
    gui?: xTerminal;
}

const TerminalContext = createContext<TerminalContextI>({
    open: false,
    toggle: () => {},
    setOpen: () => {},
    inputText: () => {},
});

export function TerminalContextProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [gui, setGui] = useState<xTerminal>();

    const { socket, isConnected } = useSocket();

    useEffect(() => {
        // Create gui on mount
        if (!gui) {
            const term = new xTerminal({
                cursorBlink: true,
                macOptionIsMeta: true,
            });
            setGui(term);
        }
    }, []);

    // Attatch socketio handler
    useEffect(() => {
        if (!gui || !isConnected) return;

        gui!.onData((data) => {
            socket.emit("ptyInput", { input: data });
        });

        function onOutput(data: { output: string }) {
            gui!.write(data.output);
        }
        socket.on("ptyOutput", onOutput);

        return () => {
            socket.off("ptyOutput", onOutput);
        };
    }, [isConnected, gui, socket]);

    function inputText(t: string) {
        socket.emit("ptyInput", { input: t });
    }

    const terminalState: TerminalContextI = {
        open,
        toggle: () => setOpen(!open),
        setOpen,
        inputText,
        socket,
        gui,
    };

    return (
        <TerminalContext.Provider value={terminalState}>
            {children}
        </TerminalContext.Provider>
    );
}

export function useTerminalContext() {
    return React.useContext(TerminalContext);
}
