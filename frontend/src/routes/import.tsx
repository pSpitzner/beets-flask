import { createContext, useContext, useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { Button, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";

import { useImportSocket } from "@/components/common/useSocket";

export const Route = createFileRoute("/import")({
    component: ImportPage,
});

function ImportPage() {
    return (
        <ImportContextProvider>
            <ImportView />
        </ImportContextProvider>
    );
}

function ImportView() {
    const { socket, isConnected } = useImportContext();

    useEffect(() => {
        console.log(socket);
        console.log(isConnected);
    }, [socket, isConnected]);

    return (
        <>
            <Typography>Is Connected: {isConnected ? "yes" : "no"}</Typography>
            <Button>Button</Button>
        </>
    );
}

/* ---------------------------------------------------------------------------------- */
/*                                       Socket                                       */
/* ---------------------------------------------------------------------------------- */

interface ConfirmableMessage {
    event: string;
    id: string;
    data: unknown;
}

interface ImportContextI {
    isConnected: boolean;
    receivedMessages: ConfirmableMessage[];
    socket?: Socket;
}

const ImportContext = createContext<ImportContextI>({
    isConnected: false,
    receivedMessages: [],
});

const ImportContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [receivedMessages, setReceivedMessages] = useState<ConfirmableMessage[]>([]);

    const { socket, isConnected } = useImportSocket();

    useEffect(() => {
        function confirmReceive(msg: ConfirmableMessage): void {
            setReceivedMessages((prev) => {
                if (!prev.some((m) => m.id === msg.id)) {
                    return [...prev, msg];
                }
                return prev;
            });
            socket.emit("receipt", { id: msg.id });
        }

        function handleText(msg: ConfirmableMessage) {
            confirmReceive(msg);
            console.log("Importer text update", msg);
        }

        function handleCandidates(msg: ConfirmableMessage) {
            confirmReceive(msg);
            console.log("Importer candidates", msg);
        }

        function handlePrompt(msg: ConfirmableMessage) {
            confirmReceive(msg);
            console.log("Importer prompt", msg);
        }

        socket.on("text", handleText);
        socket.on("candidates", handleCandidates);
        socket.on("prompt", handlePrompt);

        return () => {
            socket.off("text", handleText);
            socket.off("candidates", handleCandidates);
            socket.off("prompt", handlePrompt);
        };
    });

    const socketState: ImportContextI = {
        isConnected,
        receivedMessages,
        socket,
    };

    return (
        <ImportContext.Provider value={socketState}>{children}</ImportContext.Provider>
    );
};

const useImportContext = () => {
    const context = useContext(ImportContext);
    if (!context) {
        throw new Error(
            "useImportContext must be used within a ImportSocketContextProvider"
        );
    }
    return context;
};
