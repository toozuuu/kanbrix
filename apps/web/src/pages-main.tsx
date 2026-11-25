import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <LandingPage marketingOnly />
  </BrowserRouter>,
);
