import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import socket from "../socket";
import { getChatHistory, markChatRead, sendChatMessage } from "../api/chatApi";
import { getEncryptionPublicKey, saveEncryptionIdentity } from "../api/authApi";
import { createDeviceEncryptionIdentity, decryptChatContent, downloadDecryptedFile, encryptChatContent, encryptChatFile, getDeviceEncryptionIdentity, saveDeviceEncryptionIdentity } from "../services/e2eCrypto";
import { useAuth } from "../context/AuthContext";

const ChatPage = () => {
  const { peerId } = useParams();
  const { user, accessToken, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const role = user?.role || searchParams.get("role") || "client";
  const userId = user?.id || searchParams.get("userId") || "";
  const selfName = user?.name || searchParams.get("selfName") || (role === "lawyer" ? "Lawyer" : "You");
  const peerName = searchParams.get("peerName") || (role === "lawyer" ? "Client" : "Lawyer");

  const clientId = role === "client" ? userId : peerId;
  const lawyerId = role === "client" ? peerId : userId;

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [privateKey, setPrivateKey] = useState(null);
  const [peerPublicKey, setPeerPublicKey] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [sendingFile, setSendingFile] = useState(false);
  const endRef = useRef(null);

  const conversationKey = useMemo(() => `${clientId}:${lawyerId}`, [clientId, lawyerId]);

  const decryptMessages = useCallback(async (items, key, peerKey) => Promise.all(items.map(async (message) => {
    try { return { ...message, content: await decryptChatContent(message.content, key, peerKey, conversationKey) }; }
    catch { return { ...message, content: "Unable to decrypt this message." }; }
  })), [conversationKey]);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const markConversationRead = useCallback(async () => {
    if (!clientId || !lawyerId || !userId) {
      return;
    }

    await markChatRead({ clientId, lawyerId, readerId: userId, accessToken });
  }, [clientId, lawyerId, userId, accessToken]);

  const loadHistory = useCallback(async () => {
    if (!clientId || !lawyerId) {
      setError("Missing chat participants.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getChatHistory({ clientId, lawyerId, accessToken });

      setMessages(privateKey && peerPublicKey ? await decryptMessages(data.messages || [], privateKey, peerPublicKey) : data.messages || []);
      setError("");

      if ((data.unreadCount || 0) > 0) {
        await markConversationRead();
      }
    } catch (chatError) {
      setError(chatError.message || "Failed to load chat history");
    } finally {
      setLoading(false);
    }
  }, [clientId, lawyerId, markConversationRead, accessToken, privateKey, peerPublicKey, decryptMessages]);

  useEffect(() => {
    if (!accessToken || !userId) return undefined;
    socket.auth = { token: accessToken };
    socket.connect();
    socket.emit("join-user", { userId });
    return () => socket.disconnect();
  }, [accessToken, userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, conversationKey]);

  useEffect(() => {
    const handleIncomingMessage = (message) => {
      if (message.clientId !== clientId || message.lawyerId !== lawyerId) {
        return;
      }

      const addIncoming = async () => {
        const displayMessage = privateKey && peerPublicKey
          ? { ...message, content: await decryptChatContent(message.content, privateKey, peerPublicKey, conversationKey) }
          : message;
        setMessages((currentMessages) => {
        if (currentMessages.some((item) => item.id === message.id)) {
            return currentMessages.map((item) => (item.id === message.id ? displayMessage : item));
        }
          return [...currentMessages, displayMessage];
        });
      };
      addIncoming().catch(() => setError("Unable to decrypt this message."));

      if (message.recipientId === userId) {
        markConversationRead();
      }
    };

    const handleReadReceipt = ({ clientId: receiptClientId, lawyerId: receiptLawyerId, messageIds = [] }) => {
      if (receiptClientId !== clientId || receiptLawyerId !== lawyerId) {
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.map((item) =>
          messageIds.includes(item.id) ? { ...item, isRead: true, readAt: new Date().toISOString() } : item
        )
      );
    };

    socket.on("chat:message", handleIncomingMessage);
    socket.on("chat:read", handleReadReceipt);

    return () => {
      socket.off("chat:message", handleIncomingMessage);
      socket.off("chat:read", handleReadReceipt);
    };
  }, [clientId, lawyerId, markConversationRead, userId, privateKey, peerPublicKey, conversationKey]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (value) => {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSend = async (event) => {
    event.preventDefault();

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) {
      return;
    }

    try {
      if (!privateKey || !peerPublicKey) throw new Error("Unlock encrypted chat with your recovery passphrase first.");
      const data = await sendChatMessage({
        clientId,
        lawyerId,
        senderId: userId,
        senderRole: role,
        content: await encryptChatContent(trimmedDraft, privateKey, peerPublicKey, conversationKey),
      }, accessToken);

      const savedMessage = data.message;
      savedMessage.content = trimmedDraft;
      setMessages((currentMessages) => {
        if (currentMessages.some((item) => item.id === savedMessage.id)) {
          return currentMessages.map((item) => (item.id === savedMessage.id ? savedMessage : item));
        }

        return [...currentMessages, savedMessage];
      });
      setDraft("");
    } catch (sendError) {
      setError(sendError.message || "Failed to send message");
    }
  };

  const handleFileSend = async (event) => {
    event.preventDefault();
    if (!selectedFile) return;
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Encrypted attachments are limited to 5 MB.");
      return;
    }
    try {
      if (!privateKey || !peerPublicKey) throw new Error("Unlock encrypted chat with your recovery passphrase first.");
      setSendingFile(true);
      const content = await encryptChatFile(selectedFile, privateKey, peerPublicKey, conversationKey);
      const data = await sendChatMessage({ clientId, lawyerId, senderId: userId, senderRole: role, content }, accessToken);
      const savedMessage = { ...data.message, content: await decryptChatContent(data.message.content, privateKey, peerPublicKey, conversationKey) };
      setMessages((current) => [...current.filter((item) => item.id !== savedMessage.id), savedMessage]);
      setSelectedFile(null);
      event.currentTarget.reset();
    } catch (fileError) {
      setError(fileError.message || "Failed to send encrypted file");
    } finally {
      setSendingFile(false);
    }
  };

  useEffect(() => {
    if (!userId || !accessToken || !peerId) return undefined;
    let cancelled = false;
    const loadDeviceEncryption = async () => {
      try {
        let identity = await getDeviceEncryptionIdentity(userId);
        if (!identity) {
          identity = await createDeviceEncryptionIdentity();
          const updatedUser = await saveEncryptionIdentity({ encryptionPublicKey: identity.encryptionPublicKey }, accessToken);
          await saveDeviceEncryptionIdentity(userId, identity);
          updateUser(updatedUser);
        }
        const keyData = await getEncryptionPublicKey(peerId, accessToken);
        if (!keyData.encryptionPublicKey) {
          throw new Error("This person needs to open chat once on their device before encrypted chat can start.");
        }
        if (!cancelled) {
          setPrivateKey(identity.privateKey);
          setPeerPublicKey(keyData.encryptionPublicKey);
        }
      } catch (deviceError) {
        if (!cancelled) setError(deviceError.message || "Unable to load device encryption.");
      }
    };
    loadDeviceEncryption();
    return () => { cancelled = true; };
  }, [userId, accessToken, peerId, user?.encryptionPublicKey, updateUser]);

  return (
    <div className="page chat-shell">
      <div className="container">
        <section className="chat-panel">
          <header className="chat-header">
            <div className="chat-header-row">
              <div>
                <div className="chat-eyebrow">Saved chat history</div>
                <h1 className="chat-title">{peerName}</h1>
                <p className="chat-copy">
                  {selfName} chatting with {peerName} · Conversation {conversationKey}
                </p>
              </div>
              <div className="chat-badge">
                {role === "lawyer" ? "Lawyer view" : "Client view"}
              </div>
            </div>
            {!privateKey && <p className="chat-copy">Preparing end-to-end encryption on this device…</p>}
          </header>

          <main className="chat-body">
            {error && <div className="empty-state" style={{ marginBottom: 18, textAlign: 'left' }}>{error}</div>}

            {loading ? (
              <div className="empty-state">
                <h3 className="empty-title">Loading conversation</h3>
                <p className="empty-copy">We are fetching your messages and read receipts.</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-title">No messages yet</h3>
                <p className="empty-copy">Start the conversation and the history will be saved here.</p>
              </div>
            ) : (
              <div className="message-list">
              {messages.map((message) => {
                const isOwnMessage = message.senderId === userId;

                return (
                  <div key={message.id} className={`message ${isOwnMessage ? 'message--own' : 'message--other'}`}>
                    {typeof message.content === "object" && message.content.type === "file" ? (
                      <button type="button" className="btn btn-secondary" onClick={() => downloadDecryptedFile(message.content)} disabled={!message.content.data}>
                        Download {message.content.name} ({Math.ceil(message.content.size / 1024)} KB)
                      </button>
                    ) : <p className="message-text">{message.content}</p>}
                    <div className="message-meta">
                        <span>{formatTime(message.createdAt)}</span>
                        {isOwnMessage && (
                          <span className={`message-tick ${message.isRead ? 'message-tick--read' : 'message-tick--unread'}`}>
                            {message.isRead ? "✓✓" : "✓"}
                          </span>
                        )}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
              </div>
            )}
          </main>

          <form onSubmit={handleSend} className="chat-composer">
            <div className="composer">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Message ${peerName}...`}
                rows={2}
                className="textarea"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!draft.trim() || !privateKey || !peerPublicKey}
              >
                Send
              </button>
            </div>
          </form>
          <form onSubmit={handleFileSend} className="chat-composer">
            <div className="composer">
              <input className="field" type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} disabled={sendingFile || !privateKey || !peerPublicKey} />
              <button type="submit" className="btn btn-secondary" disabled={!selectedFile || sendingFile || !privateKey || !peerPublicKey}>
                {sendingFile ? "Encrypting…" : "Send encrypted file"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default ChatPage;
