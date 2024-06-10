import { io } from 'socket.io-client';

// "undefined" means the URL will be computed from the `window.location` object
const URL = import.meta.env.MODE === "development" ? "http://localhost:5001/terminal" : "/terminal"

export const socket = io(URL, {autoConnect:false,
    transports: ["polling"],
});
