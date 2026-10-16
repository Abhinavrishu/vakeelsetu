import { Routes, Route } from "react-router-dom";
// Pages
import ClientLandingPage from "./pages/landingpage";
// import AdminLandingPage from "./pages/AdminLandingPage"
import AudioCallPage from "./pages/AudioCallPage";
import ChatPage from "./pages/ChatPage";
// import LoginPage from "./pages/LoginPage";
// import RegisterPage from "./pages/RegisterPage";
import LawyerDashboard from "./pages/lawyerlandingpage";

const App = () => {
  return (
  
      <Routes>
        {/* 👨‍💼 Client Landing */}
        <Route path="/" element={<ClientLandingPage />} />

        
        
        {/* <Route path="/chat/:lawyerId" element={<ChatPage />} /> */}
        <Route path="/chat/:peerId" element={<ChatPage />} />
        <Route path="/call/audio/:lawyerId" element={<AudioCallPage />} />
        <Route path="/lawyerpage" element={<LawyerDashboard />} />


        {/* 🔑 Auth */}
        {/* <Route path="/login" element={<LoginPage />} /> */}
        {/* <Route path="/register" element={<RegisterPage />} /> */}
      </Routes>

  );
};

export default App;
