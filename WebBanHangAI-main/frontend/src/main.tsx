import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";

import { AdminAuthProvider } from "./app/context/AdminAuthContext";
import { router } from "./app/routes";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AdminAuthProvider>
        <RouterProvider router={router} />
      </AdminAuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
