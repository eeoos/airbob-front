import { readFileSync, readdirSync } from "fs";
import { join, relative, sep } from "path";
import * as ts from "typescript";

const sourceText = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const productionComponentFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return productionComponentFiles(absolutePath);
    }

    if (!entry.name.endsWith(".tsx") || entry.name.endsWith(".test.tsx")) {
      return [];
    }

    return [relative(process.cwd(), absolutePath).split(sep).join("/")];
  });

const isJsxOpeningLike = (
  node: ts.Node,
): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement =>
  ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node);

const staticStringValue = (expression: ts.Expression): string | null => {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text;
  }

  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return staticStringValue(expression.expression);
  }

  return null;
};

const staticJsxAttributeValue = (
  initializer: ts.JsxAttributeValue | undefined,
): string | null => {
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;

  return ts.isJsxExpression(initializer) && initializer.expression
    ? staticStringValue(initializer.expression)
    : null;
};

const hasStaticMainRole = (
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
) => {
  const roleAttribute = node.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "role",
  );
  const role = staticJsxAttributeValue(roleAttribute?.initializer);

  return (
    role?.split(/\s+/).some((value) => value.toLowerCase() === "main") ??
    false
  );
};

const collectMainLandmarkOwners = (
  relativePath: string,
  source = sourceText(relativePath),
): string[] => {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const owners: string[] = [];

  const visit = (node: ts.Node) => {
    if (isJsxOpeningLike(node)) {
      const isMainElement =
        ts.isIdentifier(node.tagName) && node.tagName.text === "main";

      if (isMainElement || hasStaticMainRole(node)) {
        owners.push(`${isMainElement ? "element" : "role"}:${relativePath}`);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return owners;
};

describe("app shell main landmark ownership", () => {
  it("keeps the active ShellFrame as the single production main owner", () => {
    const mainOwners = productionComponentFiles(
      join(process.cwd(), "src"),
    )
      .flatMap((relativePath) => collectMainLandmarkOwners(relativePath))
      .sort();

    expect(mainOwners).toEqual(["element:src/app/shells/ShellFrame.tsx"]);
  });

  it("finds static role owners without matching comments or strings", () => {
    const owners = collectMainLandmarkOwners(
      "synthetic.tsx",
      `
        const text = '<main role="main">';
        // <main role="main" />
        const Example = () => (
          <>
            <section role="main" />
            <div role={"main"} />
            <article role={\`main\`} />
          </>
        );
      `,
    );

    expect(owners).toEqual([
      "role:synthetic.tsx",
      "role:synthetic.tsx",
      "role:synthetic.tsx",
    ]);
  });
});
