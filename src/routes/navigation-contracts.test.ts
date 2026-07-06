import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

const productionSourceExtensions = [".ts", ".tsx"];

const collectProductionSourceFiles = (relativeDirectory: string): string[] =>
  readdirSync(join(process.cwd(), relativeDirectory), { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = `${relativeDirectory}/${entry.name}`;

      if (entry.isDirectory()) {
        return collectProductionSourceFiles(relativePath);
      }

      const isProductionSource =
        productionSourceExtensions.some((extension) =>
          entry.name.endsWith(extension)
        ) &&
        !entry.name.includes(".test.") &&
        !entry.name.endsWith(".d.ts");

      return isProductionSource ? [relativePath] : [];
    });

const sourceText = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const scopedNavigationFiles = collectProductionSourceFiles("src");

const paymentNavigationFiles = [
  "src/features/reservations/PaymentFailRoute.tsx",
  "src/features/reservations/PaymentSuccessRoute.tsx",
];

const sourceFile = (relativePath: string) => {
  const source = sourceText(relativePath);

  return ts.createSourceFile(
    relativePath,
    source,
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

const isTrackedRouterLinkElement = (
  node: ts.Node
): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement => {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) {
    return false;
  }

  return (
    ts.isIdentifier(node.tagName) &&
    (node.tagName.text === "Link" || node.tagName.text === "NavLink")
  );
};

const isDirectInternalRouteJsxValue = (
  initializer: ts.JsxAttributeValue | undefined
): boolean => {
  if (!initializer) {
    return false;
  }

  if (ts.isStringLiteral(initializer)) {
    return startsWithInternalRoute(initializer.text);
  }

  return (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined &&
    isDirectInternalRouteString(initializer.expression)
  );
};

const collectRouterLinkViolations = (relativePath: string): string[] => {
  const source = sourceFile(relativePath);
  const violations: string[] = [];

  const visit = (node: ts.Node) => {
    if (isTrackedRouterLinkElement(node)) {
      const toAttribute = node.attributes.properties.find(
        (property): property is ts.JsxAttribute =>
          ts.isJsxAttribute(property) && property.name.text === "to"
      );

      if (isDirectInternalRouteJsxValue(toAttribute?.initializer)) {
        violations.push(formatNodeLocation(source, node));
      }
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

  it("keeps router links from using direct internal route strings", () => {
    const directStringRouterLinks =
      scopedNavigationFiles.flatMap(collectRouterLinkViolations);

    expect(directStringRouterLinks).toEqual([]);
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

  it("keeps payment route-builder navigation as push navigation outside callback cleanup", () => {
    const replaceAllowedFiles = new Set([
      "src/features/reservations/PaymentSuccessRoute.tsx",
    ]);
    const replaceNavigations = paymentNavigationFiles.flatMap((relativePath) =>
      replaceAllowedFiles.has(relativePath)
        ? []
        : collectNavigateCallViolations(relativePath, hasReplaceTrueOption)
    );

    expect(replaceNavigations).toEqual([]);
  });
});
