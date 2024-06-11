// we use a single socket, currently only needed for the terminal connection

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// "undefined" means the URL will be computed from the `window.location` object
const URL =
    import.meta.env.MODE === "development"
        ? "ws://localhost:5001/terminal"
        : "/terminal";

export const socket = io(URL, {
    autoConnect: false,
    transports: ["websocket"],
});

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(socket.connected);

    useEffect(() => {
        socket.connect();

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        function handleConnect() {
            setIsConnected(true);
        }
        function handleDisconnect() {
            setIsConnected(false);
        }

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
        };
    }, []);

    return { socket, isConnected };
};
