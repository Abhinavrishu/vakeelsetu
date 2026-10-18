import { request } from "./httpClient";

const toQueryString = (params) => new URLSearchParams(params).toString();

const authHeaders = (accessToken) => ({ Authorization: `Bearer ${accessToken}` });

export const getChatConversations = (accessToken) =>
  request("/chat/conversations", { headers: authHeaders(accessToken) });

export const getChatHistory = ({ clientId, lawyerId, accessToken }) =>
  request(`/chat/history?${toQueryString({ clientId, lawyerId })}`, { headers: authHeaders(accessToken) });

export const sendChatMessage = (message, accessToken) =>
  request("/chat/messages", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(message),
  });

export const markChatRead = ({ clientId, lawyerId, readerId, accessToken }) =>
  request("/chat/read", {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ clientId, lawyerId, readerId }),
  });
