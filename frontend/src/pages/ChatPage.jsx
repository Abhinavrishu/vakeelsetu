import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import socket from "../socket";

const API_BASE = "http://localhost:5000/api/chat";

const ChatPage = () => {
  const { peerId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "client";
  const userId = searchParams.get("userId") || (role === "lawyer" ? "lawyer-1" : "client-1");
  const selfName = searchParams.get("selfName") || (role === "lawyer" ? "Lawyer" : "You");
  const peerName = searchParams.get("peerName") || (role === "lawyer" ? "Client" : "Lawyer");

  const clientId = role === "client" ? userId : peerId;
  const lawyerId = role === "client" ? peerId : userId;

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const conversationKey = useMemo(() => `${clientId}:${lawyerId}`, [clientId, lawyerId]);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const markConversationRead = useCallback(async () => {
    if (!clientId || !lawyerId || !userId) {
      return;
    }

    await fetch(`${API_BASE}/read`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientId, lawyerId, readerId: userId }),
    });
  }, [clientId, lawyerId, userId]);

  const loadHistory = useCallback(async () => {
    if (!clientId || !lawyerId) {
      setError("Missing chat participants.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/history?clientId=${encodeURIComponent(clientId)}&lawyerId=${encodeURIComponent(lawyerId)}&viewerId=${encodeURIComponent(userId)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || "Failed to load chat history");
      }

      setMessages(data.messages || []);
      setError("");

      if ((data.unreadCount || 0) > 0) {
        await markConversationRead();
      }
    } catch (chatError) {
      setError(chatError.message || "Failed to load chat history");
    } finally {
      setLoading(false);
    }
  }, [clientId, lawyerId, markConversationRead, userId]);

  useEffect(() => {
    socket.emit("join-user", { userId });
  }, [userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, conversationKey]);

  useEffect(() => {
    const handleIncomingMessage = (message) => {
      if (message.clientId !== clientId || message.lawyerId !== lawyerId) {
        return;
      }

      setMessages((currentMessages) => {
        if (currentMessages.some((item) => item.id === message.id)) {
          return currentMessages.map((item) => (item.id === message.id ? message : item));
        }

        return [...currentMessages, message];
      });

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
  }, [clientId, lawyerId, markConversationRead, userId]);

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
      const response = await fetch(`${API_BASE}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          lawyerId,
          senderId: userId,
          senderRole: role,
          content: trimmedDraft,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || "Failed to send message");
      }

      const savedMessage = data.message;
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

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Saved chat history</p>
              <h1 className="mt-2 text-2xl font-semibold">{peerName}</h1>
              <p className="text-sm text-slate-300">
                {selfName} chatting with {peerName} · Conversation {conversationKey}
              </p>
            </div>
            <div className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200">
              {role === "lawyer" ? "Lawyer view" : "Client view"}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-5 md:px-6">
          {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-10 text-center text-slate-500">
              Loading chat history...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-10 text-center text-slate-500">
              No messages yet. Start the conversation and the history will be saved here.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message) => {
                const isOwnMessage = message.senderId === userId;

                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-3xl px-4 py-3 shadow-sm md:max-w-[64%] ${
                        isOwnMessage
                          ? "rounded-br-md bg-slate-900 text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      <div className={`mt-2 flex items-center gap-2 text-[11px] ${isOwnMessage ? "justify-end text-slate-300" : "justify-start text-slate-400"}`}>
                        <span>{formatTime(message.createdAt)}</span>
                        {isOwnMessage && (
                          <span className={message.isRead ? "text-sky-400" : "text-slate-400"}>
                            {message.isRead ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </main>

        <form onSubmit={handleSend} className="border-t border-slate-200 bg-white px-4 py-4 md:px-6">
          <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-inner">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Message ${peerName}...`}
              rows={2}
              className="min-h-[48px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!draft.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;
