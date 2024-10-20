import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthService } from "@genezio/auth";
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import Login from "./Login.tsx";
import GoogleCallback from "./GoogleCallback.tsx";
import PrivacyPolicy from "./PrivacyPolicy.tsx";
import TermsOfService from "./TermsOfService.tsx";
import './index.css'

const authInstance:AuthService = AuthService.getInstance();

authInstance.setTokenAndRegion(
  import.meta.env.VITE_AUTH_TOKEN as string,
  import.meta.env.VITE_AUTH_REGION as string,
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId="478675157292-cje3bul64nkoduku4bdaargaerujlnej.apps.googleusercontent.com">
    <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={<Login />}
          />
          <Route
            path="/"
            element={<App authInstance={authInstance} />}
          />
          <Route 
            path = "/auth/google/callback"
            element={<GoogleCallback/>}
          />
          <Route
            path="/privacy-policy"
            element={<PrivacyPolicy />}
          />
          <Route
            path="/terms-of-service"
            element={<TermsOfService />}
          />
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
)
