import * as fs from "fs";
import * as path from "path";

const readSource = (...segments: string[]) =>
  fs.readFileSync(path.join(__dirname, ...segments), "utf8");

describe("auth ownership boundary contracts", () => {
  it("keeps AuthContext as a command projection over the session owner", () => {
    const authContextSource = readSource("..", "contexts", "AuthContext.tsx");
    const forbiddenOwnership = [
      "useSessionQuery",
      "useQueryClient",
      "QueryClient",
      "authQueryKeys",
      "useEffect",
      "onAuthError",
      "triggerAuthError",
      "addEventListener",
      "createSessionBroadcast",
      "clearSession",
      "clearAuthenticatedSession",
      "refreshAuthenticatedSession",
      "clearSessionQueryData",
      "clearReservationSessionState",
      "clearAllReservationCheckoutState",
      "document.cookie",
      "sessionStorage",
      "localStorage",
      "setTimeout",
    ];

    expect(authContextSource).toMatch(/useSession\(\s*\)/);
    expect(authContextSource).toMatch(
      /state\.status\s*===\s*["']authenticated["']/,
    );
    expect(authContextSource).toMatch(
      /state\.status\s*===\s*["']checking["']/,
    );
    expect(authContextSource).toMatch(/login:\s*session\.login/);
    expect(authContextSource).toMatch(/logout:\s*session\.logout/);
    expect(authContextSource).toMatch(/checkAuth:\s*session\.revalidate/);
    expect(authContextSource).toMatch(/AuthFeatureCommandProvider/);

    forbiddenOwnership.forEach((forbiddenSource) => {
      expect(authContextSource).not.toContain(forbiddenSource);
    });
  });

  it("preserves the validated internal return-target boundary", () => {
    const requireAuthSource = readSource("..", "routes", "RequireAuth.tsx");
    const loginRouteSource = readSource(
      "..",
      "app",
      "router",
      "routes",
      "LoginRoute.tsx",
    );
    const returnTargetCodecSource = readSource(
      "..",
      "app",
      "router",
      "codecs",
      "internalReturnTargetCodec.ts",
    );

    expect(requireAuthSource).toMatch(
      /from:\s*{[\s\S]*pathname:\s*location\.pathname,[\s\S]*search:\s*location\.search,[\s\S]*hash:\s*location\.hash/,
    );
    expect(loginRouteSource).toMatch(
      /internalReturnTargetCodec\.parse\(location\.state\)/,
    );
    expect(loginRouteSource).toMatch(
      /internalReturnTargetCodec\.serialize\(returnTarget\)/,
    );
    expect(loginRouteSource).toMatch(
      /onSuccess=\{\(\)\s*=>\s*navigate\(returnPath\s*\?\?\s*routeTo\.home\(\)\)}/,
    );
    expect(returnTargetCodecSource).toMatch(/isAuthLoopPath/);
    expect(returnTargetCodecSource).toMatch(/url\.origin\s*!==\s*INTERNAL_BASE/);
  });

  it("keeps the global API barrel free of the migrated auth transport", () => {
    const apiBarrel = readSource("index.ts");

    expect(apiBarrel).not.toMatch(/authApi|["']\.\/auth["']/);
  });
});
