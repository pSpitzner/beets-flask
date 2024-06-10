import { socket } from "@/lib/socket";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/terminal")({
    component: () => <Terminal />,
});

function Terminal() {


    const [isConnected, setIsConnected] = useState(false);
    const [fooEvents, setFooEvents] = useState([]);

    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
            console.log("Terminal connected");
        }

        function onDisconnect() {
            setIsConnected(false);
            console.log("Terminal disconnected");
        }

        function onPtyOutput(data) {
            console.log(data);
        }

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("ptyOutput", onPtyOutput);
        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("ptyOutput", onPtyOutput);
        };
    }, []);

    function Input(data) {
        socket.emit("ptyInput", {"input":"ls"});
    }
    function connect(){
        socket.connect()
    }

    return (
        <div>
            <h1>Terminal</h1>
            <div>Connected: {isConnected ? "Yes" : "No"}</div>
            <div>
                <h2>Foo Events</h2>
                <button onClick={()=>{
                    Input("ls")
                }}>ls</button>
                                <button onClick={()=>{
                    connect()
                }}>connect</button>
            </div>
        </div>
    );
}
