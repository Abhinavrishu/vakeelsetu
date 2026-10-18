// src/pages/LawyerDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getChatConversations } from "../api/chatApi";

const LawyerDashboard = () => {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);

  const lawyerId = user?.id;
  const lawyerName = user?.name || "Lawyer";

  useEffect(() => {
    if (!accessToken) return;
    getChatConversations(accessToken).then((data) => setConversations(data.conversations || [])).catch(() => setConversations([]));
  }, [accessToken]);

  const openChat = (clientId, clientName) => {
    navigate(`/chat/${clientId}?role=lawyer&userId=${encodeURIComponent(lawyerId)}&selfName=${encodeURIComponent(lawyerName)}&peerName=${encodeURIComponent(clientName)}`);
  };

  const handleSignOut = () => {
    logout();
    navigate("/signin");
  };

  return (
    <div className="page dashboard-shell">
      <div className="container">
        <section className="dashboard-panel">
          <div className="dashboard-hero">
            <div>
              <div className="dashboard-eyebrow">Lawyer console</div>
              <h1 className="dashboard-title">In one place: chats and client activity.</h1>
              <p className="dashboard-copy">
                Keep client conversations organized and respond when a client is ready with details.
              </p>
            </div>

            <div className="hero-actions">
              <button onClick={() => navigate("/settings/profile")} className="btn btn-secondary">
                Profile settings
              </button>
              <button onClick={handleSignOut} className="btn btn-danger">
                Sign out
              </button>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="panel-title">Client messages</div>
            {conversations.length === 0 ? <p className="dashboard-copy">Client conversations will appear here after a client writes to you.</p> : conversations.map((conversation) => (
              <button key={conversation.peerId} onClick={() => openChat(conversation.peerId, conversation.peerName)} className="btn btn-secondary" style={{ marginRight: 8, marginTop: 8 }}>
                Open chat with {conversation.peerName}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default LawyerDashboard;
