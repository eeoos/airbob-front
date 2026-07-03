import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const migratedApiFiles = [
  "accommodations.ts",
  "reservations.ts",
  "payments.ts",
  "reviews.ts",
  "wishlist.ts",
  "recentlyViewed.ts",
  "coupons.ts",
  "commonCodes.ts",
];

const clientMethods = new Set(["get", "post", "patch", "delete"]);

type FunctionScopeAnalysis = {
  responseVariables: Set<string>;
  unwrappedVariables: Set<string>;
  hasDirectPayloadAccess: boolean;
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

const analyzeFunctionScope = (node: ts.FunctionLikeDeclaration & { body: ts.ConciseBody }) => {
  const analysis: FunctionScopeAnalysis = {
    responseVariables: new Set(),
    unwrappedVariables: new Set(),
    hasDirectPayloadAccess: false,
  };
  const directPayloadAccessOwners = new Set<string>();

  const visit = (scopeNode: ts.Node) => {
    if (scopeNode !== node.body && isFunctionLikeWithBody(scopeNode)) {
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

    if (
      ts.isCallExpression(scopeNode) &&
      ts.isIdentifier(scopeNode.expression) &&
      scopeNode.expression.text === "unwrapApiResponse"
    ) {
      const responseName = scopeNode.arguments[0]
        ? getResponseDataOwnerName(scopeNode.arguments[0])
        : undefined;

      if (responseName !== undefined) {
        analysis.unwrappedVariables.add(responseName);
      }
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

const collectApiResponseContractViolations = (fileName: string, sourceFile: ts.SourceFile) => {
  const violations: string[] = [];

  const visit = (node: ts.Node) => {
    if (isFunctionLikeWithBody(node)) {
      const analysis = analyzeFunctionScope(node);

      if (analysis.hasDirectPayloadAccess) {
        violations.push(`${fileName} still has direct ApiResponse payload access`);
      }

      analysis.responseVariables.forEach((responseVariable) => {
        if (!analysis.unwrappedVariables.has(responseVariable)) {
          violations.push(
            `${fileName} must unwrap ${responseVariable}.data through unwrapApiResponse in the same function scope`,
          );
        }
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return violations;
};

const findApiResponseContractViolations = (fileName: string, source: string) => {
  const violations: string[] = [];
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  if (!/import\s*\{[^}]*\bunwrapApiResponse\b[^}]*\}\s*from\s*["']\.\/response["'];/.test(source)) {
    violations.push(`${fileName} must import unwrapApiResponse from ./response`);
  }

  if (!/\bunwrapApiResponse\s*\(/.test(source)) {
    violations.push(`${fileName} must use unwrapApiResponse`);
  }

  violations.push(...collectApiResponseContractViolations(fileName, sourceFile));

  return violations;
};

describe("migrated API response contracts", () => {
  it("reports an ApiResponse response variable without a matching unwrap", () => {
    const source = `
      import { client } from "./client";
      import { unwrapApiResponse } from "./response";
      import type { ApiResponse } from "./types";

      export const couponsApi = {
        async getCoupons() {
          const response = await client.get<ApiResponse<CouponInfos>>("/coupons");
          return unwrapApiResponse(response.data);
        },
        async issueCoupon(couponId: number) {
          const response = await client.post<ApiResponse<null>>(\`/coupons/\${couponId}/issue\`);
        },
      };
    `;

    expect(findApiResponseContractViolations("fixture.ts", source)).toContain(
      "fixture.ts must unwrap response.data through unwrapApiResponse in the same function scope",
    );
  });

  it("reports the ApiResponse variable that is not unwrapped even when counts match", () => {
    const source = `
      import { client } from "./client";
      import { unwrapApiResponse } from "./response";
      import type { ApiResponse } from "./types";

      export const couponsApi = {
        async getCoupons() {
          const firstResponse = await client.get<ApiResponse<CouponInfos>>("/coupons/first");
          const secondResponse = await client.get<ApiResponse<CouponInfos>>("/coupons/second");

          return [
            unwrapApiResponse(firstResponse.data),
            unwrapApiResponse(firstResponse.data),
          ];
        },
      };
    `;

    expect(findApiResponseContractViolations("fixture.ts", source)).toContain(
      "fixture.ts must unwrap secondResponse.data through unwrapApiResponse in the same function scope",
    );
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
      import { unwrapApiResponse } from "./response";
      import type { ApiResponse } from "./types";

      export const couponsApi = {
        async getCoupons() {
          const response = await client.get<ApiResponse<CouponInfos>>("/coupons");
          const directPayload = ${directAccess};
          return {
            directPayload,
            unwrappedPayload: unwrapApiResponse(response.data),
          };
        },
      };
    `;

    expect(findApiResponseContractViolations("fixture.ts", source)).toContain(
      "fixture.ts still has direct ApiResponse payload access",
    );
  });

  it("unwraps ApiResponse envelopes through unwrapApiResponse", () => {
    const violations: string[] = [];

    migratedApiFiles.forEach((fileName) => {
      const source = fs.readFileSync(path.join(__dirname, fileName), "utf8");
      violations.push(...findApiResponseContractViolations(fileName, source));
    });

    expect(violations).toEqual([]);
  });
});
