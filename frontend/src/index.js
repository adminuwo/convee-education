import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

if (typeof document !== "undefined") {
  document.title = "Convee";
  let link = document.querySelector("link[rel*='icon']") || document.createElement("link");
  link.type = "image/svg+xml";
  link.rel = "shortcut icon";
  link.href = "/favicon.svg";
  document.getElementsByTagName("head")[0].appendChild(link);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
