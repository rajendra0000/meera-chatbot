import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { ChatPage } from "./pages/ChatPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AdminSandboxPage } from "./pages/AdminSandboxPage";

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/admin/sandbox" element={<AdminSandboxPage />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
