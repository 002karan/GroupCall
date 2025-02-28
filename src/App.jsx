import React from "react";
import { WebRTCProvider } from "./context/WebRTCContext";
import './App.css'
import VideoRoom from "./components/VideoRoom";
import RoomJoin from "./RoomJoin/RoomJoin";
import CodeEditor from "./codeMIrror";


function App() {
  return (
    <>
    <WebRTCProvider>
      <RoomJoin />
      <div className="min-h-screen bg-white text-black p-4">
        <h1 className="text-2xl font-bold text-center">Multi-User Video Chat Room</h1>
      
      </div>
    </WebRTCProvider>


    </>
  );
}

export default App;
