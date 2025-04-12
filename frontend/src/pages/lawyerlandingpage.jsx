// src/pages/LawyerDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

const LawyerDashboard = () => {
  const [incomingCall, setIncomingCall] = useState(false);
  const [callerId, setCallerId] = useState(null);
  const [offer, setOffer] = useState(null);
  const navigate = useNavigate();

  const lawyerId = "1"; // Change this to "2" to test other lawyer

  useEffect(() => {
    socket.on("receive-offer", ({ offer, callerId, targetLawyerId }) => {
      if (targetLawyerId === lawyerId) {
        console.log("📞 Incoming call from:", callerId);
        setIncomingCall(true);
        setCallerId(callerId);
        setOffer(offer);
      }
    });

    return () => {
      socket.off("receive-offer");
    };
  }, [lawyerId]);

  const acceptCall = async () => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("send-ice-candidate-from-lawyer", {
          clientId: callerId,
          candidate: event.candidate,
        });
      }
    };

    peer.ontrack = (event) => {
      const remoteAudio = document.getElementById("remoteAudio");
      if (remoteAudio) {
        remoteAudio.srcObject = event.streams[0];
      }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("send-answer", { callerId, answer });

    navigate(`/audio-call/${callerId}`);
  };

  const rejectCall = () => {
    socket.emit("send-decline", { callerId });
    setIncomingCall(false);
    setCallerId(null);
    setOffer(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-6">👨‍⚖️ Lawyer Dashboard (ID: {lawyerId})</h1>

        {!incomingCall && (
          <p className="text-lg text-gray-600">Waiting for incoming calls...</p>
        )}

        {incomingCall && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">
              📞 Incoming Call from: <span className="font-mono">{callerId}</span>
            </h2>
            <div className="flex justify-center gap-4">
              <button
                onClick={acceptCall}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                Accept
              </button>
              <button
                onClick={rejectCall}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LawyerDashboard;
