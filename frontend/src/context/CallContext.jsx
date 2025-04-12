import { createContext, useContext, useState, useRef, useCallback } from "react";

const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const peerConnection = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [currentCall, setCurrentCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("calling");

  // Toggle mute state
  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        if (track.kind === "audio") {
          track.enabled = !track.enabled; // Toggle the mute/unmute
        }
      });
      setIsMuted((prev) => !prev);
    }
  }, [localStream]);

  return (
    <CallContext.Provider
      value={{
        peerConnection,
        localStream,
        remoteStream,
        currentCall,
        callStatus,
        isMuted,
        setLocalStream,
        setRemoteStream,
        setCurrentCall,
        setCallStatus,
        toggleMute,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
