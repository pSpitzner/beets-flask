// we use a single socket, currently only needed for the terminal connection

import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { QueryClient } from "@tanstack/react-query";

import { TagI } from "../tags/_query";

/* ---------------------------------------------------------------------------------- */
/*                                      Terminal                                      */
/* ---------------------------------------------------------------------------------- */

const TERMINAL_URL =
    import.meta.env.MODE === "development"
        ? "ws://localhost:5001/terminal"
        : "/terminal";

const termSocket = io(TERMINAL_URL, {
    autoConnect: true,
    transports: ["websocket"],
});

export const useTerminalSocket = () => {
    const [isConnected, setIsConnected] = useState(termSocket.connected);

    useEffect(() => {
        termSocket.connect();

        return () => {
            termSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        function handleConnect() {
            console.log("Terminal websocket connected");
            setIsConnected(true);
        }
        function handleDisconnect() {
            console.log("Terminal websocket disconnected");
            setIsConnected(false);
        }

        termSocket.on("connect", handleConnect);
        termSocket.on("disconnect", handleDisconnect);

        return () => {
            termSocket.off("connect", handleConnect);
            termSocket.off("disconnect", handleDisconnect);
        };
    }, []);

    return { socket: termSocket, isConnected };
};

/* ---------------------------------------------------------------------------------- */
/*                                 Interactive Import                                 */
/* ---------------------------------------------------------------------------------- */

const IMPORT_URL =
    import.meta.env.MODE === "development" ? "ws://localhost:5001/import" : "/import";

const importSocket = io(IMPORT_URL, {
    autoConnect: false,
    transports: ["websocket"],
});

export const useImportSocket = () => {
    const [isConnected, setIsConnected] = useState(importSocket.connected);

    useEffect(() => {
        importSocket.connect();

        return () => {
            importSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        function handleConnect() {
            console.log("Import websocket connected");
            setIsConnected(true);
        }
        function handleDisconnect() {
            console.log("Import websocket disconnected");
            setIsConnected(false);
        }

        importSocket.on("connect", handleConnect);
        importSocket.on("disconnect", handleDisconnect);

        return () => {
            importSocket.off("connect", handleConnect);
            importSocket.off("disconnect", handleDisconnect);
        };
    }, []);

    return { socket: importSocket, isConnected };
};

/* ---------------------------------------------------------------------------------- */
/*                           Status Updates, (previous SSE)                           */
/* ---------------------------------------------------------------------------------- */


interface StatusInvalidationI {
    attributes: Record<string, string> | "all";
    message?: string;
    tagId?: string;
    tagPath?: string;
}

const STATUS_URL =
    import.meta.env.MODE === "development" ? "ws://localhost:5001/status" : "/status";

const statusSocket = io(STATUS_URL, {
    autoConnect: true,
    transports: ["websocket"],
});

interface StatusContextI {
    isConnected: boolean;
    socket?: Socket;
}

const StatusContext = createContext<StatusContextI>({
    isConnected: false,
});

export const useStatusSocket = () => {
    const context = useContext(StatusContext);
    if (!context) {
        throw new Error(
            "useStatusSocket must be used within a StatusSocketContextProvider"
        );
    }
    return context;
};

export const StatusContextProvider = ({
    children,
    client,
}: {
    children: React.ReactNode;
    client: QueryClient;
}) => {
    const [isConnected, setIsConnected] = useState(statusSocket.connected);

    useEffect(() => {
        statusSocket.connect();

        function handleConnect() {
            console.log("Status websocket connected");
            setIsConnected(true);
        }

        function handleDisconnect() {
            console.log("Status websocket disconnected");
            setIsConnected(false);
        }

        function handleTagUpdate(data: StatusInvalidationI) {
            console.log("Tag Update", data);

            if (data.attributes === "all") {
                if (data.tagId)
                    client
                        .invalidateQueries({ queryKey: ["tag", data.tagId] })
                        .catch(console.error);
                if (data.tagPath)
                    client
                        .invalidateQueries({ queryKey: ["tag", data.tagPath] })
                        .catch(console.error);
            } else {
                const attrs = data.attributes;
                if (data.tagId)
                    client.setQueryData(["tag", data.tagId], (old: TagI) => {
                        return { ...old, ...attrs };
                    });
                if (data.tagPath)
                    client.setQueryData(["tag", data.tagPath], (old: TagI) => {
                        return { ...old, ...attrs };
                    });
            }
        }

        function handleInboxUpdates(data: StatusInvalidationI) {
            if (data.attributes === "all") {
                client
                    .invalidateQueries({
                        queryKey: ["inbox"],
                    })
                    .catch(console.error);
            } else {
                throw new Error(
                    "Inbox update with partial attributes is not supported"
                );
            }
        }

        statusSocket.on("connect", handleConnect);
        statusSocket.on("disconnect", handleDisconnect);
        statusSocket.on("tag", handleTagUpdate);
        statusSocket.on("inbox", handleInboxUpdates);

        return () => {
            statusSocket.off("connect", handleConnect);
            statusSocket.off("disconnect", handleDisconnect);
            statusSocket.off("tag", handleTagUpdate);
            statusSocket.off("inbox", handleInboxUpdates);
        };
    }, [client]);

    const socketState: StatusContextI = {
        socket: statusSocket,
        isConnected,
    };

    return (
        <StatusContext.Provider value={socketState}>{children}</StatusContext.Provider>
    );
};
