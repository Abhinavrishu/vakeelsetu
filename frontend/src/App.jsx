import { Route, Routes } from "react-router-dom";
// Pages
import ClientLandingPage from "./pages/landingpage";
// import AdminLandingPage from "./pages/AdminLandingPage"
import ChatPage from "./pages/ChatPage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import LawyerDashboard from "./pages/lawyerlandingpage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import { RequireAuth, RequireLawyer } from "./components/RouteGuards";

const App = () => {
  return (
  
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <ClientLandingPage />
            </RequireAuth>
          }
        />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/login" element={<SignInPage />} />
        <Route path="/register" element={<SignUpPage />} />

        
        
        {/* <Route path="/chat/:lawyerId" element={<ChatPage />} /> */}
        <Route
          path="/chat/:peerId"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        <Route
          path="/lawyerpage"
          element={
            <RequireLawyer>
              <LawyerDashboard />
            </RequireLawyer>
          }
        />
        <Route path="/settings/profile" element={<RequireAuth><ProfileSettingsPage /></RequireAuth>} />


        {/* 🔑 Auth */}
        {/* <Route path="/login" element={<LoginPage />} /> */}
        {/* <Route path="/register" element={<RegisterPage />} /> */}
      </Routes>

  );
};

export default App;
