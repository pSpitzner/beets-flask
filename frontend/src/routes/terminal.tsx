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
        // no-op if the socket is already connected
        socket.connect();

        return () => {
          socket.disconnect();
        };
      }, []);


    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
            console.log("Terminal connected");
        }

        function onDisconnect() {
            setIsConnected(false);
            console.log("Terminal disconnected");
        }

        function onPtyOutput(data:any) {
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

    function Input(data:string) {
        socket.emit("ptyInput", {"input":data});
    }
    function connect(){
        console.log("Terminal connecting")
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
                <p></p>
                                <button onClick={()=>{
                    connect()
                }}>connect</button>
            </div>
        </div>
    );
}
