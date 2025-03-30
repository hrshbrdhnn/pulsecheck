import { io } from "socket.io-client";
const socket = io(location.protocol + "//" + location.hostname + ":3002");
console.log(location.protocol + "//" + location.hostname + ":3002");
export default socket;