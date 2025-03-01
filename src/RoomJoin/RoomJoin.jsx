import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io(import.meta.env.VITE_SOCKETIO, { transports: ["websocket"] });

const RoomJoin = () => {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [localStream, setLocalStream] = useState(null);
  const localVideoRef = useRef(null);
  const peerConnections = useRef({});
  const localStreamRef = useRef(null);

  useEffect(() => {
    const setupLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        setLocalStream(localStreamRef.current)

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          setLocalStream(localVideoRef.current.srcObject)

        }

        // console.log("Local stream ID:", stream.id);
      } catch (err) {
        console.error('Failed to access camera/mic', err);
      }
    };

    setupLocalStream();
  }, []);






  useEffect(() => {
    if (joined) {
      const setupLocalStream = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStreamRef.current = stream;

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }

          // console.log("Local stream ID:", stream.id);

          socket.emit('newProducer', {
            roomId,
            producerId: socket.id,
            streamId: stream.id
          });

          socket.on('existingProducers', async (producers) => {
            for (const producer of producers) {
              if (producer.producerId !== socket.id) {
                await connectToProducer(producer.producerId);
              }
            }
          });

          socket.on('newProducerAvailable', async ({ producerId }) => {
            if (producerId !== socket.id) {
              await connectToProducer(producerId);
            }
          });

          socket.on('offer', async ({ from, offer }) => {
            // console.log("Received offer from:", from);
            let peerConnection = peerConnections.current[from] || createPeerConnection(from);

            localStreamRef.current.getTracks().forEach((track) => {
              if (!peerConnection.getSenders().some((sender) => sender.track === track)) {
                peerConnection.addTrack(track, localStreamRef.current);
              }
            });

            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer', { to: from, answer });
          });

          socket.on('answer', async ({ from, answer }) => {
            // console.log("Received answer from:", from);
            const peerConnection = peerConnections.current[from];
            if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            }
          });

          socket.on('iceCandidate', ({ from, candidate }) => {
            console.log(`Received ICE candidate from: ${from}`);
            const peerConnection = peerConnections.current[from];
            if (peerConnection) {
              // console.log("Received ICE candidate from:", from);
              peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
          });

          socket.on("userDisconnected", ({ peerId }) => {
            console.log(`Peer disconnected: ${peerId}`);

            if (peerConnections.current[peerId]) {
              peerConnections.current[peerId].close();
              delete peerConnections.current[peerId];
            }

            setRemoteStreams((prev) => {
              const updated = new Map(prev);
              updated.delete(peerId);
              return new Map(updated);
            });
          });


        } catch (err) {
          console.error('Failed to access camera/mic', err);
        }
      };

      const connectToProducer = async (producerId) => {
        if (peerConnections.current[producerId]) {
          console.warn(`Already connected to producer: ${producerId}`);
          return; // Prevent duplicate connections
        }

        console.log(`Connecting to producer: ${producerId}`);
        const peerConnection = createPeerConnection(producerId);

        localStreamRef.current.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStreamRef.current);
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("offer", { roomId, offer, to: producerId });
      };


      const createPeerConnection = (peerId) => {
        const peerConnection = new RTCPeerConnection();

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(`Sending ICE candidate to: ${peerId}`);
            socket.emit('iceCandidate', {
              to: peerId,
              candidate: event.candidate,
            });
          }
        };

        peerConnection.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            // console.log(`Receiving stream from ontrack: ${peerId}, Stream ID: ${event.streams[0].id}`);
            setRemoteStreams((prev) => {
              const updated = new Map(prev);
              updated.set(peerId, event.streams[0]);
              return updated;
            });
          }
        };

        peerConnection.getSenders().forEach((sender) => {
          if (sender.track.kind === "video") {
            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];

            params.encodings[0].maxBitrate = 500000; // 500kbps
            params.encodings[0].minBitrate = 300000; // 300kbps
            params.encodings[0].maxFramerate = 30;   // 30fps
            sender.setParameters(params);
          }
        });

        peerConnection.getTransceivers().forEach(transceiver => {
          if (transceiver.sender.track.kind === "video") {
            transceiver.setCodecPreferences([
              { mimeType: "video/VP9" },
              { mimeType: "video/VP8" },
              { mimeType: "video/H264" },
            ]);
          }
        });


        peerConnections.current[peerId] = peerConnection;
        return peerConnection;
      };

      setupLocalStream();

      return () => {
        socket.off('offer');
        socket.off('answer');
        socket.off('iceCandidate');
        socket.off('newProducerAvailable');
        socket.off('existingProducers');
        socket.off('peerLeft');

        Object.values(peerConnections.current).forEach((peerConnection) => peerConnection.close());
        peerConnections.current = {};

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
        }
      };
    }
  }, [joined]);

  const handleJoinRoom = () => {
    if (roomId.trim() !== '') {
      socket.emit('joinRoom', { roomId });
      setJoined(true);
    }
  };

  const handleLeaveRoom = () => {
    socket.emit('leaveRoom', { roomId });
    setJoined(false);
  };


  const getStats = async () => {
    for (const peerId in peerConnections.current) {
      const peerConnection = peerConnections.current[peerId];

      if (peerConnection) {
        const stats = await peerConnection.getStats();
        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            const bitrate = report.bytesSent * 8 / (report.timestamp / 1000); // Convert to bps
            console.log(`📊 Outbound | Peer: ${peerId} | Bitrate: ${bitrate} bps`);
          }
          if (report.type === "inbound-rtp" && report.kind === "video") {
            const bitrate = report.bytesReceived * 8 / (report.timestamp / 1000);
            console.log(`📊 Inbound | Peer: ${peerId} | Bitrate: ${bitrate} bps`);
          }
        });
      }
    }
  };


  useEffect(() => {
    if (joined) {
      const interval = setInterval(() => {
        getStats();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [joined]);



  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white text-black">
      {!joined ? (
        <div className="bg-gray-200 p-8 rounded-lg shadow-lg">
          <h1 className="text-2xl mb-4">Join a Room</h1>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="p-2 rounded w-full text-black"
          />
          <button
            onClick={handleJoinRoom}
            className="mt-4 w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Join Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 p-4 w-full">

          {Array.from(remoteStreams.entries()).map(([producerId, stream], index) => {
            // console.log(`Stream ${index + 1}: Producer ID: ${producerId}, Stream ID: ${stream?.id}`);

            return (
              <div key={producerId} className="bg-gray-100 rounded-lg p-2">
                <p className="text-center font-bold">User ID: {producerId}</p>
                <video
                  autoPlay
                  ref={(video) => {
                    if (video && video.srcObject !== stream) {

                      video.srcObject = stream;
                    }
                  }}
                  className="w-full h-auto rounded-lg"
                  style={{ border: '2px solid red' }}
                />
              </div>
            );
          })}

        </div>
      )}
      <div className="bg-gray-100 rounded-lg p-2">
        <p className="text-center font-bold">Your Video</p>
        <video ref={localVideoRef} autoPlay muted className="w-full h-auto rounded-lg" style={{ border: '2px solid red' }} />
      </div>
    </div>

  );
};

export default RoomJoin;
