import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io(import.meta.env.VITE_SOCKETIO);

const RoomJoin = () => {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const localVideoRef = useRef(null);
  const peerConnections = useRef({});
  const localStreamRef = useRef(null);

  useEffect(() => {
    if (joined) {
      const setupLocalStream = async () => {
        try {
          if (!localStreamRef.current) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }

            socket.emit('newProducer', { roomId, producerId: socket.id });

            socket.on('existingProducers', async (producers) => {
              for (const producer of producers) {
                if (producer.producerId !== socket.id && !peerConnections.current[producer.producerId]) {
                  await connectToProducer(producer.producerId);
                }
              }
            });

            socket.on('newProducerAvailable', async ({ producerId }) => {
              if (producerId !== socket.id && !peerConnections.current[producerId]) {
                await connectToProducer(producerId);
              }
            });

            socket.on('offer', async ({ from, offer }) => {
              let peerConnection = peerConnections.current[from];
              if (!peerConnection) {
                peerConnection = createPeerConnection(from);
              }

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
              const peerConnection = peerConnections.current[from];
              if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
              }
            });

            socket.on('iceCandidate', ({ from, candidate }) => {
              const peerConnection = peerConnections.current[from];
              if (peerConnection) {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
              }
            });

            socket.on('peerLeft', ({ producerId }) => {
              if (peerConnections.current[producerId]) {
                peerConnections.current[producerId].close();
                delete peerConnections.current[producerId];
              }
              setRemoteStreams((prev) => {
                const updated = new Map(prev);
                updated.delete(producerId);
                return updated;
              });
            });
          }
        } catch (err) {
          console.error('Failed to access camera/mic', err);
        }
      };

      const connectToProducer = async (producerId) => {
        if (peerConnections.current[producerId]) return; // Prevent duplicate connections
        const peerConnection = createPeerConnection(producerId);

        localStreamRef.current.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStreamRef.current);
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { roomId, offer, to: producerId });
      };

      const createPeerConnection = (peerId) => {
        const peerConnection = new RTCPeerConnection();

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('iceCandidate', {
              to: peerId,
              candidate: event.candidate,
            });
          }
        };

        peerConnection.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStreams((prev) => {
              const updated = new Map(prev);
              updated.set(peerId, event.streams[0]);
              return updated;
            });
          }
        };

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
          <div className="bg-gray-100 rounded-lg p-2">
            <p className="text-center font-bold">Your Video</p>
            <video ref={localVideoRef} autoPlay muted className="w-full h-auto rounded-lg" style={{ border: '2px solid red' }} />
          </div>
          {Array.from(remoteStreams.entries()).map(([producerId, stream]) => (
            <div key={producerId} className="bg-gray-100 rounded-lg p-2">
              <p className="text-center font-bold">User ID: {producerId}</p>
              <video
                autoPlay
                ref={(video) => {
                  if (video && stream) {
                    video.srcObject = stream;
                  }
                }}
                className="w-full h-auto rounded-lg"
                style={{ border: '2px solid red' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoomJoin;
