import { readFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

const scopedNavigationFiles = [
  "src/components/Header/Header.tsx",
  "src/components/Header/UserMenu.tsx",
  "src/components/AccommodationCard/BaseAccommodationCard.tsx",
  "src/components/AccommodationCard/AccommodationCard.Search.tsx",
  "src/components/AccommodationActionModal/AccommodationActionModal.tsx",
  "src/components/ReservationModal/ReservationModal.tsx",
  "src/components/Map/Map.tsx",
  "src/features/accommodations/hooks/useAccommodationBooking.ts",
  "src/features/search/hooks/useSearchBarState.ts",
  "src/pages/Auth/Login/Login.tsx",
  "src/pages/Auth/Signup/Signup.tsx",
  "src/pages/AccommodationEdit/AccommodationEdit.tsx",
  "src/pages/Profile/GuestTrips/GuestTrips.tsx",
  "src/pages/Profile/HostReservationDetail/HostReservationDetail.tsx",
  "src/pages/Profile/HostReservations/HostReservations.tsx",
  "src/pages/Reservations/ReservationConfirm.tsx",
  "src/pages/Reservations/ReservationDetail.tsx",
  "src/pages/Reservations/ReviewCreate.tsx",
  "src/pages/Reservations/PaymentFail.tsx",
  "src/pages/Reservations/PaymentSuccess.tsx",
  "src/pages/Search/Search.tsx",
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

const isWindowOpenCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === "window" &&
  node.expression.name.text === "open";

const isStringNavigationTarget = (node: ts.Expression): boolean =>
  ts.isStringLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  ts.isTemplateExpression(node);

const startsWithInternalRoute = (text: string) =>
  text.startsWith("/") && !text.startsWith("//");

const isDirectInternalRouteString = (node: ts.Expression): boolean => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return startsWithInternalRoute(node.text);
  }

  if (ts.isTemplateExpression(node)) {
    return startsWithInternalRoute(node.head.text);
  }

  return false;
};

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

const collectCallViolations = (
  relativePath: string,
  isTrackedCall: (callExpression: ts.CallExpression) => boolean,
  isViolation: (callExpression: ts.CallExpression) => boolean
): string[] => {
  const source = sourceFile(relativePath);
  const violations: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      isTrackedCall(node) &&
      isViolation(node)
    ) {
      violations.push(formatNodeLocation(source, node));
    }

    ts.forEachChild(node, visit);
  };

  visit(source);

  return violations;
};

const collectNavigateCallViolations = (
  relativePath: string,
  isViolation: (callExpression: ts.CallExpression) => boolean
): string[] => collectCallViolations(relativePath, isNavigateCall, isViolation);

const collectWindowOpenCallViolations = (
  relativePath: string,
  isViolation: (callExpression: ts.CallExpression) => boolean
): string[] => collectCallViolations(relativePath, isWindowOpenCall, isViolation);

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

  it("keeps scoped pages from opening internal routes with direct route strings", () => {
    const directStringWindowOpens = scopedNavigationFiles.flatMap((relativePath) =>
      collectWindowOpenCallViolations(relativePath, (callExpression) => {
        const navigationTarget = callExpression.arguments[0];

        return (
          navigationTarget !== undefined &&
          isDirectInternalRouteString(navigationTarget)
        );
      })
    );

    expect(directStringWindowOpens).toEqual([]);
  });

  it("allows external URLs in window.open targets", () => {
    expect(
      isDirectInternalRouteString(
        ts.factory.createStringLiteral("https://www.google.com/maps")
      )
    ).toBe(false);
    expect(
      isDirectInternalRouteString(
        ts.factory.createStringLiteral("//www.google.com/maps")
      )
    ).toBe(false);
    expect(
      isDirectInternalRouteString(
        ts.factory.createStringLiteral("/accommodations/1")
      )
    ).toBe(true);
  });

  it("keeps payment route-builder navigation as push navigation", () => {
    const replaceNavigations = paymentNavigationFiles.flatMap((relativePath) =>
      collectNavigateCallViolations(relativePath, hasReplaceTrueOption)
    );

    expect(replaceNavigations).toEqual([]);
  });
});
