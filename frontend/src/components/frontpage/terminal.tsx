import { ChevronDown, Terminal as TerminalIcon } from "lucide-react";
import React, {
    createContext,
    Dispatch,
    SetStateAction,
    useEffect,
    useRef,
    useState,
} from "react";
import { Socket } from "socket.io-client";
import { Button, IconButton, Portal, Slide } from "@mui/material";
import { FitAddon as xTermFitAddon } from "@xterm/addon-fit";
import { Terminal as xTerminal } from "@xterm/xterm";

import { useSocket } from "@/components/common/useSocket";

import "node_modules/@xterm/xterm/css/xterm.css";
import styles from "./terminal.module.scss";

// match our style - this is somewhat redundant with main.css
const xTermTheme = {
    red: "#C0626B",
    green: "#A4BF8C",
    yellow: "#EBCB8C",
    blue: "#7EA2BF",
    magenta: "#B48EAD",
    cyan: "#8FBCBB",
    brightBlack: "#818689",
    brightRed: "#D0737F",
    brightGreen: "#B5D0A0",
    brightYellow: "#F0D9A6",
    brightBlue: "#8FB8D1",
    brightMagenta: "#C79EC4",
    brightCyan: "#A3CDCD",
};

const SlideIn = ({ children }: { children: React.ReactNode }) => {
    const { open, toggle, setOpen } = useTerminalContext();

    // prevent scrolling of main content when terminal is open
    // would be nicer to scroll depending on where the mouser cursor is, but that seems more difficult.
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }
    }, [open]);

    // keyboard shortcut to toggle terminal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Backquote" && e.ctrlKey) {
                if (open) {
                    setOpen(false);
                } else {
                    setOpen(true);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, setOpen]);

    return (
        <>
            <Button
                variant="outlined"
                color="primary"
                onClick={toggle}
                className={styles.terminalExpandButton}
                startIcon={<TerminalIcon size={14} />}
            >
                Terminal
            </Button>
            <Portal container={document.getElementById("app")}>
                <div className={styles.slideIn} data-open={open}>
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
                            <div className={styles.terminalOuterContainer}>
                                {children}
                            </div>
                        </div>
                    </Slide>
                </div>
            </Portal>
        </>
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
    const { term } = useTerminalContext();

    useEffect(() => {
        if (!ref.current || !term) return;
        const ele = ref.current;
        function copyPasteHandler(e: KeyboardEvent) {
            if (!term) return false;

            if (e.type !== "keydown") return true;

            if (e.ctrlKey && e.shiftKey) {
                const key = e.key.toLowerCase();
                if (key === "v") {
                    // ctrl+shift+v: paste whatever is in the clipboard
                    navigator.clipboard
                        .readText()
                        .then((toPaste) => {
                            term.write(toPaste);
                        })
                        .catch(console.error);
                    return false;
                } else if (key === "c" || key === "x") {
                    // ctrl+shift+x: copy whatever is highlighted to clipboard

                    // 'x' is used as an alternate to 'c' because ctrl+c is taken
                    // by the terminal (SIGINT) and ctrl+shift+c is taken by the browser
                    // (open devtools).
                    // I'm not aware of ctrl+shift+x being used by anything in the terminal
                    // or browser
                    const toCopy = term.getSelection();
                    navigator.clipboard.writeText(toCopy).catch(console.error);
                    term.focus();
                    return false;
                }
            }
            return true;
        }

        term.attachCustomKeyEventHandler(copyPasteHandler);

        const fitAddon = new xTermFitAddon();
        term.loadAddon(fitAddon);
        term.open(ele);
        fitAddon.fit();

        const resizeObserver = new ResizeObserver(() => {
            fitAddon.fit();
        });

        resizeObserver.observe(ele);

        return () => {
            term.dispose();
            if (ele) resizeObserver.unobserve(ele);
        };
    }, [term]);

    return <div ref={ref} className={styles.xTermBindingContainer}></div>;
}

export interface TerminalContextI {
    open: boolean;
    toggle: () => void;
    setOpen: Dispatch<SetStateAction<boolean>>;
    inputText: (input: string) => void;
    clearInput: () => void;
    socket: Socket | null;
    term?: xTerminal;
}

const TerminalContext = createContext<TerminalContextI | null>(null);

export function TerminalContextProvider({ children }: { children: React.ReactNode }) {
    const { socket, isConnected } = useSocket("terminal");

    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState<xTerminal>();

    useEffect(() => {
        // Create gui on mount
        if (!term) {
            const term = new xTerminal({
                theme: xTermTheme,
                cursorBlink: true,
                macOptionIsMeta: true,
                rows: 12,
                cols: 80,
            });
            term.write("Connecting...");
            setTerm(term);
        }
    }, [term]);

    // Attach socket handler
    useEffect(() => {
        if (!term || !isConnected || !socket) return;

        term.writeln("\rConnected!   ");

        const onInput = term.onData((data) => {
            if (data === "\x01" || data === "\x04") {
                // prevent ctrl+a because it can detach tmux, and ctrl+d because it can close the terminal
                return;
            }
            socket.emit("ptyInput", { input: data });
        });

        const onResize = term.onResize(({ cols, rows }) => {
            // console.log(`Terminal was resized to ${cols} cols and ${rows} rows.`);
            socket.emit("ptyResize", { cols, rows: rows });
        });

        function onOutput(data: { output: string[] }) {
            // term!.clear(); seems to be preferred from the documentation,
            // but it leaves the prompt on the first line in place - which we here do not want
            // ideally we would directly access the buffer.
            // console.log("ptyOutput", data);
            term!.reset();
            data.output.forEach((line, index) => {
                if (index < data.output.length - 1) {
                    term!.writeln(line);
                } else {
                    // Workaround: strip all trailing whitespaces except for one
                    // not a perfect fix (one wrong space remains when backspacing)
                    const stripped_line = line.replace(/\s+$/, " ");
                    term!.write(stripped_line);
                }
            });
        }

        function onCursorUpdate(data: { x: number; y: number }) {
            // xterm uses 1-based indexing
            term!.write(`\x1b[${data.y + 1};${data.x + 1}H`);
        }

        socket.on("ptyOutput", onOutput);
        socket.on("ptyCursorPosition", onCursorUpdate);

        // resize once on connect (after we fitted size on mount)
        socket.emit("ptyResize", { cols: term.cols, rows: term.rows });
        // request server update, so show whats actually on the pty when connecting
        socket.emit("ptyResendOutput");

        return () => {
            onResize.dispose();
            onInput.dispose();
            socket.off("ptyOutput", onOutput);
            socket.off("ptyCursorPosition", onCursorUpdate);
        };
    }, [isConnected, term, socket]);

    // make first responder directly after opening
    useEffect(() => {
        if (open && term) {
            term.focus();
        }
    }, [open, term]);

    function inputText(t: string) {
        if (!socket) {
            console.error("No socket available");
            return;
        }

        socket.emit("ptyInput", { input: t });
    }

    function clearInput() {
        if (!socket) {
            console.error("No socket available");
            return;
        }

        socket.emit("ptyInput", { input: "\x15" });
    }

    const terminalState: TerminalContextI = {
        open,
        toggle: () => setOpen(!open),
        setOpen,
        inputText,
        clearInput,
        socket,
        term,
    };

    return (
        <TerminalContext.Provider value={terminalState}>
            {children}
        </TerminalContext.Provider>
    );
}

export function useTerminalContext() {
    const context = React.useContext(TerminalContext);

    if (!context) {
        throw new Error(
            "useTerminalContext must be used within a TerminalContextProvider"
        );
    }
    return context;
}
