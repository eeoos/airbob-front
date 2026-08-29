import type { ReactElement } from "react";
import { Router, type VisibleHeaderPolicy } from "./app/router/Router";
import { Header } from "./layouts/AppHeader";
import RequireAuth from "./routes/RequireAuth";

const renderHeader = (mode: VisibleHeaderPolicy) => (
  <Header headerMode={mode} />
);

const renderAuthenticated = (content: ReactElement) => (
  <RequireAuth>{content}</RequireAuth>
);

function App() {
  return (
    <Router
      renderAuthenticated={renderAuthenticated}
      renderHeader={renderHeader}
    />
  );
}

export default App;
