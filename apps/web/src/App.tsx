import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { ToastProvider } from "./components/ui/Toast";
import { ProjectSpinner } from "./components/ui/ProjectSpinner";

import { ApiError } from "./lib/api";

// Pages
import { LandingPage } from "./pages/LandingPage";

const LoginPage = lazy(() => import("./pages/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then(m => ({ default: m.RegisterPage })));
const ProtectedLayout = lazy(() => import("./ProtectedLayout"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: (failures, error) => failures < 1 && !(error instanceof ApiError && error.status === 404),
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <ToastProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<Suspense fallback={<ProjectSpinner fullScreen message="Loading…" />}><LoginPage /></Suspense>} />
                  <Route path="/register" element={<Suspense fallback={<ProjectSpinner fullScreen message="Loading…" />}><RegisterPage /></Suspense>} />
                  <Route path="/*" element={<Suspense fallback={<ProjectSpinner fullScreen message="Loading Kanbrix…" />}><ProtectedLayout /></Suspense>} />
                </Routes>
              </BrowserRouter>
            </WorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
