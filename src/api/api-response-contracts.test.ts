import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const requestMigratedApiFiles = [
  "auth.ts",
  "accommodations.ts",
  "reservations.ts",
  "payments.ts",
  "reviews.ts",
  "wishlist.ts",
  "recentlyViewed.ts",
  "coupons.ts",
];

const explicitLegacyApiFiles = ["commonCodes.ts"];
const clientMethods = new Set(["get", "post", "patch", "delete"]);
const requestHelperNames = new Set(["requestApi", "requestApiNullable"]);

type FunctionScopeAnalysis = {
  responseVariables: Set<string>;
  helperWrappedResponseVariables: Set<string>;
  hasDirectPayloadAccess: boolean;
  hasUnroutedInlineClientCall: boolean;
};

const stripExpressionWrappers = (expression: ts.Expression): ts.Expression => {
  let current = expression;

  while (ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current)) {
    current = current.expression;
  }

  return current;
};

const getEntityNameText = (name: ts.EntityName): string => {
  if (ts.isIdentifier(name)) {
    return name.text;
  }

  return `${getEntityNameText(name.left)}.${name.right.text}`;
};

const typeReferencesApiResponse = (typeNode: ts.TypeNode): boolean => {
  let referencesApiResponse = false;

  const visit = (node: ts.Node) => {
    if (
      ts.isTypeReferenceNode(node) &&
      getEntityNameText(node.typeName).split(".").pop() === "ApiResponse"
    ) {
      referencesApiResponse = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(typeNode);
  return referencesApiResponse;
};

const isIdentifierNamed = (node: ts.Node | undefined, names: Set<string>): node is ts.Identifier =>
  Boolean(node && ts.isIdentifier(node) && names.has(node.text));

const isRequestHelperCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) && isIdentifierNamed(node.expression, requestHelperNames);

const isApiResponseClientCall = (node: ts.Node): node is ts.CallExpression => {
  if (!ts.isCallExpression(node) || !node.typeArguments?.some(typeReferencesApiResponse)) {
    return false;
  }

  const expression = stripExpressionWrappers(node.expression);

  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "client" &&
    clientMethods.has(expression.name.text)
  );
};

const isAwaitedApiResponseClientCall = (expression: ts.Expression): boolean => {
  const unwrappedExpression = stripExpressionWrappers(expression);

  return (
    ts.isAwaitExpression(unwrappedExpression) &&
    isApiResponseClientCall(stripExpressionWrappers(unwrappedExpression.expression))
  );
};

const isFunctionLikeWithBody = (
  node: ts.Node,
): node is ts.FunctionLikeDeclaration & { body: ts.ConciseBody } => {
  return (
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)) &&
    Boolean(node.body)
  );
};

const isRequestHelperCallback = (node: ts.Node): boolean => {
  const parent = node.parent;

  return (
    isFunctionLikeWithBody(node) &&
    parent !== undefined &&
    isRequestHelperCall(parent) &&
    parent.arguments.some((argument) => argument === node)
  );
};

const isInsideRequestHelperCallback = (node: ts.Node): boolean => {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (isRequestHelperCallback(current)) {
      return true;
    }

    current = current.parent;
  }

  return false;
};

const isDataPropertyAccess = (node: ts.Node): node is ts.PropertyAccessExpression => {
  return ts.isPropertyAccessExpression(node) && node.name.text === "data";
};

const isDataElementAccess = (node: ts.Node): node is ts.ElementAccessExpression => {
  return (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteral(node.argumentExpression) &&
    node.argumentExpression.text === "data"
  );
};

const getResponseDataOwnerName = (expression: ts.Expression): string | undefined => {
  const unwrappedExpression = stripExpressionWrappers(expression);

  if (isDataPropertyAccess(unwrappedExpression) || isDataElementAccess(unwrappedExpression)) {
    const owner = stripExpressionWrappers(unwrappedExpression.expression);
    return ts.isIdentifier(owner) ? owner.text : undefined;
  }

  return undefined;
};

const isPromiseResolveCall = (expression: ts.Expression): expression is ts.CallExpression => {
  const unwrappedExpression = stripExpressionWrappers(expression);

  return (
    ts.isCallExpression(unwrappedExpression) &&
    ts.isPropertyAccessExpression(unwrappedExpression.expression) &&
    ts.isIdentifier(unwrappedExpression.expression.expression) &&
    unwrappedExpression.expression.expression.text === "Promise" &&
    unwrappedExpression.expression.name.text === "resolve"
  );
};

const getPromiseResolvedIdentifier = (expression: ts.Expression): string | undefined => {
  const unwrappedExpression = stripExpressionWrappers(expression);

  if (!isPromiseResolveCall(unwrappedExpression)) {
    return undefined;
  }

  const resolvedValue = unwrappedExpression.arguments[0];
  return resolvedValue && ts.isIdentifier(resolvedValue) ? resolvedValue.text : undefined;
};

const getRequestHelperWrappedResponseName = (node: ts.CallExpression): string | undefined => {
  const requestFactory = node.arguments[0];

  if (!requestFactory || !isFunctionLikeWithBody(requestFactory)) {
    return undefined;
  }

  const body = requestFactory.body;

  if (ts.isBlock(body)) {
    const returnStatement = body.statements.find(ts.isReturnStatement);
    return returnStatement?.expression
      ? getPromiseResolvedIdentifier(returnStatement.expression)
      : undefined;
  }

  return getPromiseResolvedIdentifier(body);
};

const isApiResponseClientCallAssignedToResponseVariable = (node: ts.CallExpression): boolean => {
  const parent = node.parent;
  const maybeAwait = parent && ts.isAwaitExpression(parent) ? parent : undefined;
  const maybeDeclaration = maybeAwait?.parent;

  return Boolean(
    maybeDeclaration &&
      ts.isVariableDeclaration(maybeDeclaration) &&
      ts.isIdentifier(maybeDeclaration.name),
  );
};

const analyzeFunctionScope = (node: ts.FunctionLikeDeclaration & { body: ts.ConciseBody }) => {
  const analysis: FunctionScopeAnalysis = {
    responseVariables: new Set(),
    helperWrappedResponseVariables: new Set(),
    hasDirectPayloadAccess: false,
    hasUnroutedInlineClientCall: false,
  };
  const directPayloadAccessOwners = new Set<string>();

  const visit = (scopeNode: ts.Node) => {
    if (scopeNode !== node.body && isFunctionLikeWithBody(scopeNode) && !isRequestHelperCallback(scopeNode)) {
      return;
    }

    if (
      ts.isVariableDeclaration(scopeNode) &&
      ts.isIdentifier(scopeNode.name) &&
      scopeNode.initializer &&
      isAwaitedApiResponseClientCall(scopeNode.initializer)
    ) {
      analysis.responseVariables.add(scopeNode.name.text);
    }

    if (isRequestHelperCall(scopeNode)) {
      const responseName = getRequestHelperWrappedResponseName(scopeNode);

      if (responseName !== undefined) {
        analysis.helperWrappedResponseVariables.add(responseName);
      }
    }

    if (
      isApiResponseClientCall(scopeNode) &&
      !isInsideRequestHelperCallback(scopeNode) &&
      !isApiResponseClientCallAssignedToResponseVariable(scopeNode)
    ) {
      analysis.hasUnroutedInlineClientCall = true;
    }

    if (isDataPropertyAccess(scopeNode) || isDataElementAccess(scopeNode)) {
      const ownerName = getResponseDataOwnerName(scopeNode.expression);

      if (ownerName !== undefined) {
        directPayloadAccessOwners.add(ownerName);
      }
    }

    ts.forEachChild(scopeNode, visit);
  };

  visit(node.body);

  directPayloadAccessOwners.forEach((ownerName) => {
    if (analysis.responseVariables.has(ownerName)) {
      analysis.hasDirectPayloadAccess = true;
    }
  });

  return analysis;
};

const sourceImportsUnwrapApiResponse = (source: string) =>
  /import\s*\{[^}]*\bunwrapApiResponse\b[^}]*\}\s*from\s*["']\.\/response["'];/.test(source);

const findApiResponseContractViolations = (fileName: string, source: string) => {
  const violations: string[] = [];
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  if (sourceImportsUnwrapApiResponse(source)) {
    violations.push(
      `${fileName} must not import unwrapApiResponse from ./response; use requestApi/requestApiNullable`,
    );
  }

  if (/\bunwrapApiResponse\s*\(/.test(source)) {
    violations.push(`${fileName} must not call unwrapApiResponse directly`);
  }

  const visit = (node: ts.Node) => {
    if (isFunctionLikeWithBody(node)) {
      const analysis = analyzeFunctionScope(node);

      if (analysis.hasDirectPayloadAccess) {
        violations.push(`${fileName} still has direct ApiResponse payload access`);
      }

      if (analysis.hasUnroutedInlineClientCall) {
        violations.push(
          `${fileName} must route ApiResponse client calls through requestApi or requestApiNullable`,
        );
      }

      analysis.responseVariables.forEach((responseVariable) => {
        if (!analysis.helperWrappedResponseVariables.has(responseVariable)) {
          violations.push(
            `${fileName} must route ${responseVariable} through requestApi or requestApiNullable`,
          );
        }
      });

      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return violations;
};

describe("migrated API response contracts", () => {
  it("reports direct unwrap imports and calls in domain API modules", () => {
    const source = `
      import { client } from "./client";
      import { unwrapApiResponse } from "./response";
      import type { ApiResponse } from "./types";

      export const couponApi = {
        async getCoupons() {
          const response = await client.get<ApiResponse<CouponInfos>>("/coupons");
          return unwrapApiResponse(response.data);
        },
      };
    `;

    expect(findApiResponseContractViolations("fixture.ts", source)).toEqual(
      expect.arrayContaining([
        "fixture.ts must not import unwrapApiResponse from ./response; use requestApi/requestApiNullable",
        "fixture.ts must not call unwrapApiResponse directly",
      ]),
    );
  });

  it("reports ApiResponse client calls outside requestApi/requestApiNullable", () => {
    const source = `
      import { client } from "./client";
      import { requestApi } from "./request";
      import type { ApiResponse } from "./types";

      export const couponApi = {
        async getCoupons() {
          return client.get<ApiResponse<CouponInfos>>("/coupons");
        },
        async issueCoupon(couponId: number) {
          return requestApi(() =>
            client.post<ApiResponse<CouponIssueResult>>(\`/coupons/\${couponId}/issue\`)
          );
        },
      };
    `;

    expect(findApiResponseContractViolations("fixture.ts", source)).toContain(
      "fixture.ts must route ApiResponse client calls through requestApi or requestApiNullable",
    );
  });

  it("reports response variables that are not routed through a request helper", () => {
    const source = `
      import { client } from "./client";
      import { requestApi } from "./request";
      import type { ApiResponse } from "./types";

      export const authApi = {
        async getMe() {
          const response = await client.get<ApiResponse<MeInfo>>("/auth/me");
          return response.data;
        },
        async getProfile() {
          const response = await client.get<ApiResponse<Profile>>("/profile");
          return requestApi(() => Promise.resolve(response));
        },
      };
    `;

    expect(findApiResponseContractViolations("fixture.ts", source)).toContain(
      "fixture.ts must route response through requestApi or requestApiNullable",
    );
  });

  it("allows response-level checks before routing the response through requestApi", () => {
    const source = `
      import { client } from "./client";
      import { requestApi } from "./request";
      import type { ApiResponse } from "./types";

      export const authApi = {
        async getMe() {
          const response = await client.get<ApiResponse<MeInfo>>("/auth/me");
          const contentType = response.headers?.["content-type"];

          if (typeof contentType === "string" && contentType.includes("text/html")) {
            throw new Error("Invalid API Response");
          }

          return requestApi(() => Promise.resolve(response));
        },
      };
    `;

    expect(findApiResponseContractViolations("fixture.ts", source)).toEqual([]);
  });

  it.each([
    ["response.data.data"],
    ["response.data?.data"],
    ['response.data["data"]'],
    ["(response.data).data"],
    ["response.data!.data"],
  ])("reports direct ApiResponse payload access via %s", (directAccess) => {
    const source = `
      import { client } from "./client";
      import { requestApi } from "./request";
      import type { ApiResponse } from "./types";

      export const couponsApi = {
        async getCoupons() {
          const response = await client.get<ApiResponse<CouponInfos>>("/coupons");
          const directPayload = ${directAccess};
          return requestApi(() => Promise.resolve(response));
        },
      };
    `;

    expect(findApiResponseContractViolations("fixture.ts", source)).toContain(
      "fixture.ts still has direct ApiResponse payload access",
    );
  });

  it("routes migrated domain API envelopes through requestApi or requestApiNullable", () => {
    const violations: string[] = [];

    requestMigratedApiFiles.forEach((fileName) => {
      const source = fs.readFileSync(path.join(__dirname, fileName), "utf8");
      violations.push(...findApiResponseContractViolations(fileName, source));
    });

    expect(violations).toEqual([]);
  });

  it("documents API modules intentionally excluded from the Task B request-helper migration", () => {
    expect(explicitLegacyApiFiles).toEqual(["commonCodes.ts"]);
  });
});
