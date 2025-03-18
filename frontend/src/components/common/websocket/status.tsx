/** Status Updates
 *
 * Allows to invalidate data based on status updates from the server.
 *
 * We use a context which is wrapped around the app on are relatively
 * high level. This context provides the socket connection and allows
 * to invalidate and refetch queries by sending messages from the server.
 *
 */

import { createContext, useContext, useEffect } from "react";
import type { Socket } from "socket.io-client";
import { useSocket } from "./useSocket";
import type { QueryClient } from "@tanstack/react-query";

interface StatusContextI {
    isConnected: boolean;
    socket: Socket | null;
}

const StatusContext = createContext<StatusContextI | null>(null);

export function StatusContextProvider({
    children,
    client,
}: {
    children: React.ReactNode;
    client: QueryClient;
}) {
    const { socket, isConnected } = useSocket("status");

    useEffect(() => {
        if (!socket) return;

        function handleUpdate(data: unknown) {
            console.log("Status Update", data);
        }

        socket.on("update", handleUpdate);

        return () => {
            socket.off("update", handleUpdate);
        };
    }, [socket, client]);

    return (
        <StatusContext.Provider value={{ isConnected, socket }}>
            {children}
        </StatusContext.Provider>
    );
}

export const useStatusSocket = () => {
    const context = useContext(StatusContext);
    if (!context) {
        throw new Error(
            "useStatusSocket must be used within a StatusSocketContextProvider"
        );
    }
    return context;
};
