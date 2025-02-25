import React, { createContext, useContext, useState } from "react";

const WebRTCContext = createContext();

export const useWebRTC = () => useContext(WebRTCContext);

export const WebRTCProvider = ({ children }) => {
  const [peers, setPeers] = useState({});
  const [localStream, setLocalStream] = useState(null);

  const addPeer = (peerId, stream) => {
    setPeers((prev) => ({ ...prev, [peerId]: stream }));
  };

  const removePeer = (peerId) => {
    setPeers((prev) => {
      const updated = { ...prev };
      delete updated[peerId];
      return updated;
    });
  };

  return (
    <WebRTCContext.Provider value={{ peers, addPeer, removePeer, localStream, setLocalStream }}>
      {children}
    </WebRTCContext.Provider>
  );
};
