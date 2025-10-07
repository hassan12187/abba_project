import { io } from "../index.js";

const WebSocketService=()=>{
    io.on("connection",(socket)=>{
    console.log('A user connected',socket.id);
    socket.on("ping",()=>{
        console.log("Recieved Ping");
        socket.emit("pong");
    });
    socket.on("disconnected",()=>{
        console.log("User Disconnected",socket.id);
    });
});
};
export default WebSocketService;