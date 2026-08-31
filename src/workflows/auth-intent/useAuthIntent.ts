import { useContext } from "react";
import { AuthIntentContext } from "./authIntentContext";

export const useAuthIntent = () => {
  const context = useContext(AuthIntentContext);
  if (!context) {
    throw new Error("useAuthIntent must be used within AuthIntentProvider.");
  }

  return context;
};
