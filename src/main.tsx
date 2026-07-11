import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./styles/global.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const reloadOnControl = !navigator.serviceWorker.controller;
  if (reloadOnControl) {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
  }
  void navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}coi-serviceworker.js`,
    {
      scope: import.meta.env.BASE_URL,
    },
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
