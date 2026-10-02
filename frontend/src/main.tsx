import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyThemeToDocument, getStoredTheme } from "./utils/theme";

// Áp dụng theme (Light/Dark) ngay từ đầu để tránh chớp màn hình (FOUC)
applyThemeToDocument(getStoredTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(

  <React.StrictMode>
    <App />
  </React.StrictMode>
);
