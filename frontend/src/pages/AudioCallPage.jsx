import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCall } from "../context/CallContext";
import socket from "../socket";

const AudioCallPage = () => {
  const { lawyerId } = useParams();
  const {
    peerConnection,
    setPeerConnection,
    localStream,
    setLocalStream,
    setRemoteStream,
    setCurrentCall,
    remoteStream,
    isMuted,
    callStatus,
    toggleMute,
    setCallStatus,
  } = useCall();

  useEffect(() => {
    const startCall = async () => {
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      setPeerConnection(peer);

      try {
        // Get local audio stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);

        // Add local stream tracks to the peer connection
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        // ICE Candidate event
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("send-ice-candidate", { lawyerId, candidate: event.candidate });
          }
        };

        // Handle remote stream when received
        peer.ontrack = (event) => {
          const remoteStream = event.streams[0];
          setRemoteStream(remoteStream);

          const remoteAudio = document.getElementById("remoteAudio");
          if (remoteAudio) remoteAudio.srcObject = remoteStream;
        };

        // Create offer and send to the lawyer
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("send-offer", { lawyerId, offer });

        setCurrentCall(true); // Indicating the call is active
        setCallStatus("in-progress");
      } catch (err) {
        console.error("Error starting audio call:", err);
        setCallStatus("ended");
      }
    };

    startCall();

    socket.on("receive-answer", (answer) => {
      if (peerConnection.current) {
        peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("receive-ice-candidate", (candidate) => {
      if (peerConnection.current) {
        peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // Cleanup function to close peer connection and remove event listeners
    return () => {
      socket.off("receive-answer");
      socket.off("receive-ice-candidate");
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      setCurrentCall(false); // Reset call state when the component is unmounted or call ends
    };
  }, [lawyerId, peerConnection, setPeerConnection, setLocalStream, setRemoteStream, setCurrentCall, setCallStatus]);

  const endCall = () => {
    // End the call and clean up resources
    if (peerConnection.current) {
      peerConnection.current.close();
      setPeerConnection(null);
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setCurrentCall(false);
    setCallStatus("ended");
    window.location.href = "/"; // Example redirect to homepage after call
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="flex flex-col items-center">
        <img
          src="/path-to-avatar-image.jpg" // Replace with dynamic avatar
          alt="Caller Avatar"
          className="w-24 h-24 rounded-full mb-4"
        />
        <h2 className="text-2xl font-semibold mb-4">
          Audio Call {callStatus === "calling" ? "Ringing..." : "In Progress"}
        </h2>
      </div>
      <audio id="remoteAudio" autoPlay controls className={remoteStream ? "" : "hidden"} />

      {/* Call control buttons */}
      {callStatus === "in-progress" && (
        <div className="flex space-x-4 mt-4">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full ${isMuted ? "bg-gray-500" : "bg-blue-500"} text-white`}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={endCall}
            className="p-3 bg-red-500 rounded-full text-white"
          >
            End Call
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioCallPage;
