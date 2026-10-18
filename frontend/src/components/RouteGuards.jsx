import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const RequireAuth = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/signin" replace />;
};

export const RequireLawyer = ({ children }) => {
  const { isAuthenticated, isLawyer } = useAuth();

  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  return isLawyer ? children : <Navigate to="/" replace />;
};
