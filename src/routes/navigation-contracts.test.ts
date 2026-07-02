import { readFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

const scopedNavigationFiles = [
  "src/pages/Profile/GuestTrips/GuestTrips.tsx",
  "src/pages/Profile/HostReservations/HostReservations.tsx",
  "src/pages/Reservations/PaymentFail.tsx",
  "src/pages/Reservations/PaymentSuccess.tsx",
];

const paymentNavigationFiles = [
  "src/pages/Reservations/PaymentFail.tsx",
  "src/pages/Reservations/PaymentSuccess.tsx",
];

const sourceFile = (relativePath: string) => {
  const sourceText = readFileSync(join(process.cwd(), relativePath), "utf8");

  return ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
};

const isNavigateCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === "navigate";

const isStringNavigationTarget = (node: ts.Expression): boolean =>
  ts.isStringLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  ts.isTemplateExpression(node);

const isReplaceTrueProperty = (
  property: ts.ObjectLiteralElementLike
): property is ts.PropertyAssignment => {
  if (!ts.isPropertyAssignment(property)) {
    return false;
  }

  const { name, initializer } = property;
  const isReplaceProperty =
    (ts.isIdentifier(name) && name.text === "replace") ||
    (ts.isStringLiteral(name) && name.text === "replace");

  return isReplaceProperty && initializer.kind === ts.SyntaxKind.TrueKeyword;
};

const hasReplaceTrueOption = (callExpression: ts.CallExpression): boolean => {
  const navigationOptions = callExpression.arguments[1];

  return (
    navigationOptions !== undefined &&
    ts.isObjectLiteralExpression(navigationOptions) &&
    navigationOptions.properties.some(isReplaceTrueProperty)
  );
};

const formatNodeLocation = (
  source: ts.SourceFile,
  node: ts.Node
): string => {
  const { line, character } = source.getLineAndCharacterOfPosition(
    node.getStart(source)
  );

  return `${source.fileName}:${line + 1}:${character + 1} ${node.getText(source)}`;
};

const collectNavigateCallViolations = (
  relativePath: string,
  isViolation: (callExpression: ts.CallExpression) => boolean
): string[] => {
  const source = sourceFile(relativePath);
  const violations: string[] = [];

  const visit = (node: ts.Node) => {
    if (isNavigateCall(node) && isViolation(node)) {
      violations.push(formatNodeLocation(source, node));
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  return violations;
};

describe("navigation route builder contracts", () => {
  it("keeps scoped pages from navigating with direct route strings", () => {
    const directStringNavigations = scopedNavigationFiles.flatMap((relativePath) =>
      collectNavigateCallViolations(relativePath, (callExpression) => {
        const navigationTarget = callExpression.arguments[0];

        return (
          navigationTarget !== undefined &&
          isStringNavigationTarget(navigationTarget)
        );
      })
    );

    expect(directStringNavigations).toEqual([]);
  });

  it("keeps payment route-builder navigation as push navigation", () => {
    const replaceNavigations = paymentNavigationFiles.flatMap((relativePath) =>
      collectNavigateCallViolations(relativePath, hasReplaceTrueOption)
    );

    expect(replaceNavigations).toEqual([]);
  });
});
