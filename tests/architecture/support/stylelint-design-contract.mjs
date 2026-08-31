import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import stylelint from "stylelint";

const require = createRequire(import.meta.url);
const {
  allowedBreakpointValues,
  canonicalTokenStylePaths,
  isVendorImportantOverridePath,
  tokenLayerPolicies,
} = require("../../../scripts/architecture/style-policy.cjs");

const supportDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(supportDirectory, "../../..");

const collectMatches = (source, pattern) =>
  new Set(
    Array.from(source.matchAll(pattern))
      .map((match) => match[1])
      .filter(Boolean),
  );
const radiusPropertyPattern =
  /^border(?:-(?:top|bottom)-(?:left|right)|-(?:start|end)-(?:start|end))?-radius$/i;

const usesCanonicalReferencesOnly = (value, canonicalProperties) => {
  const references = Array.from(
    value.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g),
  );

  return (
    references.length > 0 &&
    references.every((match) => canonicalProperties.has(match[1])) &&
    value
      .replace(/var\(\s*--[A-Za-z0-9_-]+\s*\)/g, "")
      .replace(/[\s,]/g, "") === ""
  );
};

const isSensitiveDesignConsumer = (property) =>
  radiusPropertyPattern.test(property) ||
  /^(?:aspect-ratio|background|background-color|box-shadow|color)$/i.test(
    property,
  );

const designReferenceRuleName = "airbob/no-unknown-design-reference";
const designReferenceMessages = stylelint.utils.ruleMessages(
  designReferenceRuleName,
  {
    localMedia: (name) =>
      `Custom media ${name} must be declared in a canonical custom-media file`,
    unsafePropertyAlias: (name) =>
      `Sensitive local custom property ${name} must resolve directly to canonical design tokens`,
    unknownProperty: (name) => `Unknown design custom property ${name}`,
    unknownMedia: (name) => `Unknown design custom media ${name}`,
  },
);

const createDesignReferenceRule = ({ projectRoot }) => {
  const canonicalSource = canonicalTokenStylePaths
    .map((relativePath) => path.join(projectRoot, relativePath))
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => fs.readFileSync(filePath, "utf8"))
    .join("\n");
  const canonicalProperties = collectMatches(
    canonicalSource,
    /(?:^|[;{]\s*)(--[A-Za-z0-9_-]+)\s*:/gm,
  );
  const canonicalMedia = collectMatches(
    canonicalSource,
    /@custom-media\s+(--[A-Za-z0-9_-]+)/g,
  );

  const rule = (primary) => (root, result) => {
    if (!primary) {
      return;
    }

    const localProperties = new Map();
    const localMedia = new Set();

    root.walkDecls(/^--/, (declaration) => {
      const declarations = localProperties.get(declaration.prop) ?? [];
      declarations.push(declaration);
      localProperties.set(declaration.prop, declarations);
    });
    root.walkAtRules(/^custom-media$/i, (atRule) => {
      const { params } = atRule;
      const name = params.match(/^(--[A-Za-z0-9_-]+)/)?.[1];
      if (name) {
        localMedia.add(name);
        stylelint.utils.report({
          message: designReferenceMessages.localMedia(name),
          node: atRule,
          result,
          ruleName: designReferenceRuleName,
          word: name,
        });
      }
    });

    root.walkDecls((declaration) => {
      for (const match of declaration.value.matchAll(
        /var\(\s*(--[A-Za-z0-9_-]+)/g,
      )) {
        const name = match[1];
        if (canonicalProperties.has(name)) {
          continue;
        }

        const localPropertyDeclarations = localProperties.get(name);
        if (localPropertyDeclarations) {
          if (
            isSensitiveDesignConsumer(declaration.prop) &&
            !localPropertyDeclarations.every((localProperty) =>
              usesCanonicalReferencesOnly(
                localProperty.value,
                canonicalProperties,
              ),
            )
          ) {
            stylelint.utils.report({
              message: designReferenceMessages.unsafePropertyAlias(name),
              node: declaration,
              result,
              ruleName: designReferenceRuleName,
              word: name,
            });
          }
          continue;
        }

        stylelint.utils.report({
          message: designReferenceMessages.unknownProperty(name),
          node: declaration,
          result,
          ruleName: designReferenceRuleName,
          word: name,
        });
      }
    });

    root.walkAtRules(/^media$/i, (atRule) => {
      for (const match of atRule.params.matchAll(
        /\(\s*(--[A-Za-z0-9_-]+)\s*\)/g,
      )) {
        const name = match[1];
        if (canonicalMedia.has(name) || localMedia.has(name)) {
          continue;
        }

        stylelint.utils.report({
          message: designReferenceMessages.unknownMedia(name),
          node: atRule,
          result,
          ruleName: designReferenceRuleName,
          word: name,
        });
      }
    });
  };

  rule.ruleName = designReferenceRuleName;
  rule.messages = designReferenceMessages;
  rule.meta = {
    url: "tests/architecture/dependency-rules.md#stylelint-owner",
  };

  return rule;
};

const protectedDesignLiteralRuleName =
  "airbob/no-protected-design-literal";
const protectedDesignLiteralMessages = stylelint.utils.ruleMessages(
  protectedDesignLiteralRuleName,
  {
    rejected: (contract, value) =>
      `Expected protected ${contract} literal "${value}" to use its canonical token`,
  },
);
const protectedCoreColorPattern =
  /#(?:000000|222222|717171|f7f7f7|dddddd|b0b0b0|ff385c|e61e4d|ffffff)\b/i;
const protectedCoreShadowPattern =
  /^0\s+(?:1px\s+2px|4px\s+12px)\s+rgba\(0,\s*0,\s*0,\s*(?:0\.08|0\.15)\)/i;
const existingCircularSelectors = new Set([
  ".backButton",
  ".closeButton",
  ".guestProfileImage",
  ".guestProfileImagePlaceholder",
  ".hostAvatar",
  ".hostAvatarImage",
  ".imageRemoveButton",
  ".profileImage",
  ".profileImagePlaceholder",
]);

const protectedDesignContractFor = (declaration) => {
  const { prop, value } = declaration;
  if (protectedCoreColorPattern.test(value)) {
    return "core color";
  }

  if (
    /^(?:background|background-color|color)$/i.test(prop) &&
    /^(?:white|black)\b/i.test(value.trim())
  ) {
    return "core color";
  }

  if (/^border-radius$/i.test(prop)) {
    const radiusValue = value.trim();
    const isExistingCircularControl =
      radiusValue === "50%" &&
      declaration.parent?.type === "rule" &&
      declaration.parent.selector
        .split(",")
        .every((selector) =>
          existingCircularSelectors.has(selector.trim()),
        );

    if (
      !isExistingCircularControl &&
      /^(?:(?:4px|8px|12px)\b|50%(?:\s|$))/i.test(radiusValue)
    ) {
      return "core radius";
    }
  }

  if (/^box-shadow$/i.test(prop) && protectedCoreShadowPattern.test(value)) {
    return "core shadow";
  }

  if (/^aspect-ratio$/i.test(prop) && /\b1\s*\/\s*1\b/.test(value)) {
    return "card media ratio";
  }

  return null;
};

const protectedDesignLiteralRule = (primary) => (root, result) => {
  if (!primary) {
    return;
  }

  root.walkDecls((declaration) => {
    const contract = protectedDesignContractFor(declaration);

    if (!contract) {
      return;
    }

    stylelint.utils.report({
      message: protectedDesignLiteralMessages.rejected(
        contract,
        declaration.value,
      ),
      node: declaration,
      result,
      ruleName: protectedDesignLiteralRuleName,
      word: declaration.value,
    });
  });
};

protectedDesignLiteralRule.ruleName = protectedDesignLiteralRuleName;
protectedDesignLiteralRule.messages = protectedDesignLiteralMessages;
protectedDesignLiteralRule.meta = {
  url: "tests/architecture/dependency-rules.md#stylelint-owner",
};

const rawRadiusRuleName = "airbob/no-raw-border-radius";
const rawRadiusMessages = stylelint.utils.ruleMessages(rawRadiusRuleName, {
  rejected: (value) =>
    `Expected border radius "${value}" to use a canonical radius token`,
});
const rawDimensionPattern =
  /(?<![A-Za-z0-9_-])-?(?:\d*\.)?\d+(?:[A-Za-z%]+)?/g;

const containsNonZeroRawDimension = (value) =>
  Array.from(value.matchAll(rawDimensionPattern)).some((match) => {
    const numericValue = match[0].match(/^-?(?:\d*\.)?\d+/)?.[0];

    return numericValue !== undefined && Number(numericValue) !== 0;
  });

const rawRadiusRule = (primary) => (root, result) => {
  if (!primary) {
    return;
  }

  root.walkDecls(radiusPropertyPattern, (declaration) => {
    if (!containsNonZeroRawDimension(declaration.value)) {
      return;
    }

    stylelint.utils.report({
      message: rawRadiusMessages.rejected(declaration.value),
      node: declaration,
      result,
      ruleName: rawRadiusRuleName,
      word: declaration.value,
    });
  });
};

rawRadiusRule.ruleName = rawRadiusRuleName;
rawRadiusRule.messages = rawRadiusMessages;
rawRadiusRule.meta = {
  url: "tests/architecture/dependency-rules.md#stylelint-owner",
};

const rawShadowRuleName = "airbob/no-raw-box-shadow";
const rawShadowMessages = stylelint.utils.ruleMessages(rawShadowRuleName, {
  rejected: (value) =>
    `Expected box shadow "${value}" to use a canonical shadow token`,
});
const allowedShadowKeywords = new Set([
  "inherit",
  "initial",
  "none",
  "revert",
  "revert-layer",
  "unset",
]);

const isTokenOwnedShadow = (value) => {
  const normalizedValue = value.trim().toLowerCase();

  if (allowedShadowKeywords.has(normalizedValue)) {
    return true;
  }

  return value
    .replace(/var\(\s*--[A-Za-z0-9-]+\s*\)/g, "")
    .replace(/[\s,]/g, "") === "";
};

const rawShadowRule = (primary) => (root, result) => {
  if (!primary) {
    return;
  }

  root.walkDecls(/^box-shadow$/i, (declaration) => {
    if (isTokenOwnedShadow(declaration.value)) {
      return;
    }

    stylelint.utils.report({
      message: rawShadowMessages.rejected(declaration.value),
      node: declaration,
      result,
      ruleName: rawShadowRuleName,
      word: declaration.value,
    });
  });
};

rawShadowRule.ruleName = rawShadowRuleName;
rawShadowRule.messages = rawShadowMessages;
rawShadowRule.meta = {
  url: "tests/architecture/dependency-rules.md#stylelint-owner",
};

const breakpointRuleName = "airbob/media-breakpoint-scale";
const breakpointMessages = stylelint.utils.ruleMessages(breakpointRuleName, {
  rejected: (value) =>
    `Expected media breakpoint "${value}" to use the agreed breakpoint scale`,
});
const allowedBreakpointSet = new Set(
  allowedBreakpointValues.map((value) => value.toLowerCase()),
);
const mediaLengthPattern =
  /(?<![A-Za-z0-9_.-])(?:\d*\.)?\d+(?:px|em|rem)(?![A-Za-z0-9_-])/gi;

const breakpointRule = (primary) => (root, result) => {
  if (!primary) {
    return;
  }

  root.walkAtRules(/^(?:custom-media|media)$/i, (atRule) => {
    for (const match of atRule.params.matchAll(mediaLengthPattern)) {
      const value = match[0].toLowerCase();

      if (allowedBreakpointSet.has(value)) {
        continue;
      }

      stylelint.utils.report({
        message: breakpointMessages.rejected(match[0]),
        node: atRule,
        result,
        ruleName: breakpointRuleName,
        word: match[0],
      });
    }
  });
};

breakpointRule.ruleName = breakpointRuleName;
breakpointRule.messages = breakpointMessages;
breakpointRule.meta = {
  url: "tests/architecture/dependency-rules.md#stylelint-owner",
};

const tokenLayerRuleName = "airbob/token-layer-contract";
const tokenLayerMessages = stylelint.utils.ruleMessages(tokenLayerRuleName, {
  backwardReference: (consumer, reference) =>
    `${consumer} may not reference later-layer token ${reference}`,
  derivedLiteral: (name) =>
    `${name} must be a direct alias; only primitive tokens may own raw values`,
  forwardReference: (consumer, reference) =>
    `${consumer} may only reference tokens declared earlier in the same layer (${reference})`,
  missingOwner: (name) =>
    `${name} is not registered in the centralized token layer policy`,
  unknownReference: (consumer, reference) =>
    `${consumer} references unknown canonical token ${reference}`,
  wrongOwner: (name, expected, actual) =>
    `${name} belongs to the ${expected} token layer, not ${actual}`,
});
const directTokenAliasPattern = /^var\(\s*--[a-z0-9-]+\s*\)$/;
const tokenReferencePattern = /var\(\s*(--[a-z0-9-]+)\s*\)/g;

const createTokenLayerRule = ({ projectRoot }) => {
  const layerRankByPath = new Map(
    tokenLayerPolicies.map(({ path: relativePath }, rank) => [relativePath, rank]),
  );
  const expectedOwnerByToken = new Map();
  const canonicalOwners = new Map();

  tokenLayerPolicies.forEach((layerPolicy, rank) => {
    layerPolicy.tokenNames.forEach((tokenName) => {
      if (expectedOwnerByToken.has(tokenName)) {
        throw new Error(`Duplicate token layer policy owner: ${tokenName}`);
      }

      expectedOwnerByToken.set(tokenName, {
        name: layerPolicy.name,
        rank,
      });
    });

    const relativePath = layerPolicy.path;
    const filePath = path.join(projectRoot, relativePath);

    if (!fs.existsSync(filePath)) {
      return;
    }

    Array.from(
      fs.readFileSync(filePath, "utf8").matchAll(
        /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm,
      ),
    ).forEach((match, order) => {
      canonicalOwners.set(match[1], { order, rank });
    });
  });

  const rule = (primary) => (root, result) => {
    if (!primary) {
      return;
    }

    const sourcePath = root.source?.input.file;
    const projectPath = sourcePath
      ? path.relative(projectRoot, sourcePath).replaceAll("\\", "/")
      : "";
    const consumerRank = layerRankByPath.get(projectPath);

    if (consumerRank === undefined) {
      return;
    }

    const declarations = [];
    root.walkDecls(/^--[a-z0-9-]+$/, (declaration) => {
      declarations.push(declaration);
    });
    const localOwners = new Map(
      declarations.map((declaration, order) => [
        declaration.prop,
        { order, rank: consumerRank },
      ]),
    );

    declarations.forEach((declaration, consumerOrder) => {
      const expectedOwner = expectedOwnerByToken.get(declaration.prop);
      const actualOwnerName = tokenLayerPolicies[consumerRank].name;

      if (!expectedOwner) {
        stylelint.utils.report({
          message: tokenLayerMessages.missingOwner(declaration.prop),
          node: declaration,
          result,
          ruleName: tokenLayerRuleName,
          word: declaration.prop,
        });
      } else if (expectedOwner.rank !== consumerRank) {
        stylelint.utils.report({
          message: tokenLayerMessages.wrongOwner(
            declaration.prop,
            expectedOwner.name,
            actualOwnerName,
          ),
          node: declaration,
          result,
          ruleName: tokenLayerRuleName,
          word: declaration.prop,
        });
      }

      if (
        consumerRank > 0 &&
        !directTokenAliasPattern.test(declaration.value.trim())
      ) {
        stylelint.utils.report({
          message: tokenLayerMessages.derivedLiteral(declaration.prop),
          node: declaration,
          result,
          ruleName: tokenLayerRuleName,
          word: declaration.value,
        });
      }

      for (const match of declaration.value.matchAll(tokenReferencePattern)) {
        const reference = match[1];
        const owner = localOwners.get(reference) ?? canonicalOwners.get(reference);

        if (!owner) {
          stylelint.utils.report({
            message: tokenLayerMessages.unknownReference(
              declaration.prop,
              reference,
            ),
            node: declaration,
            result,
            ruleName: tokenLayerRuleName,
            word: reference,
          });
          continue;
        }

        if (owner.rank > consumerRank) {
          stylelint.utils.report({
            message: tokenLayerMessages.backwardReference(
              declaration.prop,
              reference,
            ),
            node: declaration,
            result,
            ruleName: tokenLayerRuleName,
            word: reference,
          });
          continue;
        }

        if (owner.rank === consumerRank && owner.order >= consumerOrder) {
          stylelint.utils.report({
            message: tokenLayerMessages.forwardReference(
              declaration.prop,
              reference,
            ),
            node: declaration,
            result,
            ruleName: tokenLayerRuleName,
            word: reference,
          });
        }
      }
    });
  };

  rule.ruleName = tokenLayerRuleName;
  rule.messages = tokenLayerMessages;
  rule.meta = {
    url: "tests/architecture/dependency-rules.md#stylelint-owner",
  };

  return rule;
};

const vendorDisableScopeRuleName =
  "airbob/vendor-important-disable-scope";
const vendorDisableScopeMessages = stylelint.utils.ruleMessages(
  vendorDisableScopeRuleName,
  {
    rejected: () =>
      "Only a described disable-next-line for declaration-no-important is allowed in integration-owned vendor CSS",
  },
);
const allowedVendorDisablePattern =
  /^stylelint-disable-next-line\s+declaration-no-important\s+--\s+\S(?:.*\S)?$/;

const createVendorDisableScopeRule = ({ projectRoot }) =>
  (primary) => (root, result) => {
    if (!primary) {
      return;
    }

    const sourcePath = root.source?.input.file;
    const projectPath = sourcePath
      ? path.relative(projectRoot, sourcePath).replaceAll("\\", "/")
      : "";
    const isVendorIntegrationStyle =
      isVendorImportantOverridePath(projectPath);

    root.walkComments((comment) => {
      const command = comment.text.trim();
      const normalizedCommand = command.replace(/\s+/g, " ");

      if (
        !/stylelint-(?:disable|enable).*declaration-no-important/.test(
          normalizedCommand,
        )
      ) {
        return;
      }

      if (
        isVendorIntegrationStyle &&
        !/[\r\n]/.test(command) &&
        allowedVendorDisablePattern.test(command)
      ) {
        const nextNode = comment.next();
        const nextLine = nextNode?.source?.start?.line;
        const isImmediatelyBeforeDeclaration =
          nextNode?.type === "decl" &&
          nextNode.important === true &&
          nextLine === (comment.source?.end?.line ?? -2) + 1;
        let importantDeclarationsOnLine = 0;

        if (isImmediatelyBeforeDeclaration) {
          root.walkDecls((declaration) => {
            if (
              declaration.important &&
              declaration.source?.start?.line === nextLine
            ) {
              importantDeclarationsOnLine += 1;
            }
          });
        }

        if (
          isImmediatelyBeforeDeclaration &&
          importantDeclarationsOnLine === 1
        ) {
          return;
        }
      }

      stylelint.utils.report({
        message: vendorDisableScopeMessages.rejected(),
        node: comment,
        result,
        ruleName: vendorDisableScopeRuleName,
      });
    });
  };

const vendorDisableScopeRule = createVendorDisableScopeRule({
  projectRoot: defaultProjectRoot,
});
vendorDisableScopeRule.ruleName = vendorDisableScopeRuleName;
vendorDisableScopeRule.messages = vendorDisableScopeMessages;
vendorDisableScopeRule.meta = {
  url: "tests/architecture/dependency-rules.md#stylelint-owner",
};

export const createDesignContractPlugins = ({ projectRoot }) => [
  stylelint.createPlugin(
    designReferenceRuleName,
    createDesignReferenceRule({ projectRoot }),
  ),
  stylelint.createPlugin(
    protectedDesignLiteralRuleName,
    protectedDesignLiteralRule,
  ),
  stylelint.createPlugin(rawRadiusRuleName, rawRadiusRule),
  stylelint.createPlugin(rawShadowRuleName, rawShadowRule),
  stylelint.createPlugin(breakpointRuleName, breakpointRule),
  stylelint.createPlugin(
    tokenLayerRuleName,
    createTokenLayerRule({ projectRoot }),
  ),
  stylelint.createPlugin(
    vendorDisableScopeRuleName,
    Object.assign(createVendorDisableScopeRule({ projectRoot }), {
      messages: vendorDisableScopeMessages,
      meta: vendorDisableScopeRule.meta,
      ruleName: vendorDisableScopeRuleName,
    }),
  ),
];

export default createDesignContractPlugins({
  projectRoot: defaultProjectRoot,
});
