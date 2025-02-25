import React, { useEffect } from "react";
import socket from "../socket";
import { useWebRTC } from "../context/WebRTCContext";
import useMediaStream from "../hooks/useMediaStream";

const VideoRoom = ({ roomId }) => {
  const { localStream, peers, addPeer, removePeer } = useWebRTC();

  useMediaStream();

  useEffect(() => {
    if (roomId) {
      socket.emit("joinRoom", { roomId });

      socket.on("newProducerAvailable", ({ producerId }) => {
        // Placeholder for consuming media streams from SFU
        console.log("New producer available: ", producerId);
        // Connect to Mediasoup SFU to receive this stream
      });

      socket.on("userDisconnected", ({ peerId }) => {
        removePeer(peerId);
      });
    }

    return () => {
      socket.emit("leaveRoom", { roomId });
    };
  }, [roomId, addPeer, removePeer]);

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {/* Local Video Stream */}
      {localStream && (
        <video
          autoPlay
          muted
          ref={(video) => {
            if (video) video.srcObject = localStream;
          }}
          className="rounded-lg shadow-lg"
        />
      )}

      {/* Remote Peers */}
      {Object.keys(peers).map((peerId) => (
        <video
          key={peerId}
          autoPlay
          ref={(video) => {
            if (video) video.srcObject = peers[peerId];
          }}
          className="rounded-lg shadow-lg"
        />
      ))}
    </div>
  );
};

export default VideoRoom;
