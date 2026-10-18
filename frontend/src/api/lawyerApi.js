import { request } from "./httpClient";

export const getLawyers = async () => {
  const data = await request("/lawyers");
  return data.lawyers || [];
};
