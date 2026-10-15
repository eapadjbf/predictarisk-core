// Domínios antigos passam para o domínio oficial (mantém caminho e parâmetros).
if (/(^|\.)cyberguardsys\.com$|\.replit\.app$/.test(window.location.hostname)) {
  window.location.replace("https://predictarisk.ai" + window.location.pathname + window.location.search + window.location.hash);
}

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
