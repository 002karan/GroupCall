import { useEffect } from "react";
import { useWebRTC } from "../context/WebRTCContext";

const useMediaStream = () => {
  const { setLocalStream } = useWebRTC();

  useEffect(() => {
    const startStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.error("Failed to access media devices", err);
      }
    };

    startStream();
  }, [setLocalStream]);
};

export default useMediaStream;
