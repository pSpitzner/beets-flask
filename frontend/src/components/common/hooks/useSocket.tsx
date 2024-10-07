// we use a single socket, currently only needed for the terminal connection

import { createContext, useContext, useEffect, useState } from "react";
import { QueryClient } from "@tanstack/react-query";

import { TagI } from "../../tags/_query";
import { io, ManagerOptions, Socket, SocketOptions } from "socket.io-client";

/**
 * Custom hook to manage a WebSocket connection for a specific namespace.
 *
 * @param namespace - The namespace for the WebSocket connection.
 * @param options - Optional configuration options for the WebSocket connection.
 *
 * @returns An object containing the WebSocket instance and a boolean indicating whether the connection is active.
 *
 * This hook initializes a WebSocket connection to a specified namespace and manages its lifecycle.
 * It handles connection and disconnection events, logs connection status, and provides a way to check the connection status.
 * The WebSocket instance is created inline to allow multiple instances if needed.
 *
 * Usage:
 * ```tsx
 * const { socket, isConnected } = useSocket("myNamespace");
 * ```
 */
export const useSocket = (
    namespace: string,
    options?: Partial<ManagerOptions & SocketOptions>
) => {
    const url: string =
        import.meta.env.MODE === "development"
            ? `ws://localhost:5001/${namespace}`
            : `/${namespace}`;

    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Create socket inline to allow multiple instances
    useEffect(() => {
        const socket = io(url, {
            autoConnect: false,
            transports: ["websocket"],
            ...options,
        });
        setSocket(socket);
    }, [options, url]);

    // Register minimal event handlers
    useEffect(() => {
        if (!socket) return;

        function handleConnect() {
            console.log(`${namespace}-socket connected`);
            setIsConnected(true);
        }
        function handleDisconnect() {
            console.log(`${namespace}-socket disconnected`);
            setIsConnected(false);
        }
        function handleError(e: unknown) {
            console.error(e);
        }

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleError);
        socket.connect();

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleError);
            socket.disconnect();
        };
    }, [socket, namespace]);

    return { socket, isConnected };
};

/* ---------------------------------------------------------------------------------- */
/*                           Status Updates, (previous SSE)                           */
/* ---------------------------------------------------------------------------------- */
// TODO: This should be moved into its own file / folder. Maybe a tags folder?
// We also can use the generic useSocket hook here

interface StatusInvalidationI {
    attributes: Record<string, string> | "all";
    message?: string;
    tagId?: string;
    tagPath?: string;
}

const STATUS_URL =
    import.meta.env.MODE === "development" ? "ws://localhost:5001/status" : "/status";

const statusSocket = io(STATUS_URL, {
    // Setting autoConnect to true causes issues in production mode.
    // Seems the connection is attempted before dependencies are ready.
    autoConnect: false,
    transports: ["websocket"],
});

interface StatusContextI {
    isConnected: boolean;
    socket?: Socket;
}

const StatusContext = createContext<StatusContextI | null>(null);

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
