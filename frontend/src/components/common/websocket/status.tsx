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
import { type QueryClient } from "@tanstack/react-query";

import { queryClient } from "@/api/common";
import { invalidateSession } from "@/api/session";
import { FolderStatus, FolderStatusResponse } from "@/pythonTypes";

import useSocket from "./useSocket";

import type { Socket } from "socket.io-client";
interface StatusContextI {
    isConnected: boolean;
    socket: Socket | null;
}

const StatusContext = createContext<StatusContextI | null>(null);

// FIXME: Move to api folder
export const statusQueryOptions = {
    queryKey: ["status", "all"],
    queryFn: async () => {
        // fetch initial status
        // further updates will be handled by the socket
        const response = await fetch("/session/status");
        return (await response.json()) as FolderStatusResponse[];
    },
};

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

        function handleUpdate(updateData: FolderStatusResponse) {
            // update folder status
            queryClient.setQueryData<FolderStatusResponse[]>(
                statusQueryOptions.queryKey,
                (prev) => {
                    if (!prev) return [updateData];
                    const n = [...prev];

                    // If the folder is already in the list, update it
                    let folderIndex = n.findIndex((folder) => {
                        return folder.hash === updateData.hash;
                    });
                    if (folderIndex !== -1) {
                        // Try by path if we did not find it by hash
                        folderIndex = n.findIndex((folder) => {
                            return folder.path === updateData.path;
                        });
                    }

                    if (folderIndex !== -1) {
                        n[folderIndex] = updateData;
                    } else {
                        n.push(updateData);
                    }
                    return n;
                }
            );

            // If tagged or imported refetch the session
            console.debug(
                "StatusSocket",
                "update",
                updateData,
                updateData.status,
                FolderStatus.TAGGED,
                updateData.status == FolderStatus.TAGGED
            );
            if (
                updateData.status == FolderStatus.IMPORTED ||
                updateData.status == FolderStatus.TAGGED
            ) {
                invalidateSession(updateData.hash, updateData.path, false).catch(
                    console.error
                );
            }
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
