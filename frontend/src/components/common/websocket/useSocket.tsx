import { useEffect, useState } from 'react';

import { SocketEvents, StatusSocket, TerminalSocket } from '@/api/websocket';

import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';

type SocketMapping = {
    status: StatusSocket;
    terminal: TerminalSocket;
};

/**
 * Custom hook to manage a WebSocket connection for a specific namespace.
 *
 * @param namespace - The namespace for the WebSocket connection.
 * @param options - Optional configuration options for the WebSocket connection.
 *
 * @returns An object containing the WebSocket instance and a boolean indicating whether the connection is active.
 *
 * This hook initializes a WebSocket connection to a specified namespace and manages its lifecycle.
 * It handles connection and disconnection events, logs connection status, and provide
 * a way to check the connection status.
 *
 * Usage:
 * ```tsx
 * const { socket, isConnected } = useSocket("myNamespace");
 * ```
 */
export default function useSocket<N extends keyof SocketEvents>(
    namespace: N,
    options?: Partial<ManagerOptions & SocketOptions>
) {
    const url: string = `/${namespace}`;

    const [socket, setSocket] = useState<Socket<
        SocketEvents[N]['ServerToClientEvents'],
        SocketEvents[N]['ClientToServerEvents']
    > | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Create socket inline to allow multiple instances
    useEffect(() => {
        const socket = io(url, {
            autoConnect: false,
            transports: ['websocket'],
            path: '/socket.io',
            ...options,
        }) as SocketMapping[N];
        setSocket(socket);
    }, [options, url]);

    // Register minimal event handlers
    useEffect(() => {
        if (!socket) return;

        function handleConnect() {
            console.debug('useSocket', `${namespace}-socket connected`);
            setIsConnected(true);
        }
        function handleDisconnect() {
            console.debug('useSocket', `${namespace}-socket disconnected`);
            setIsConnected(false);
        }
        function handleError(e: unknown) {
            console.error(e);
        }

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleError);
        socket.connect();

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect_error', handleError);
            socket.disconnect();
        };
    }, [socket, namespace]);

    return { socket, isConnected };
}
