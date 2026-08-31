import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createTargetPolicy } = require("./target-policy.cjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(scriptDirectory, "../..");

const filterIssueRecords = (records, isTargetPath) =>
  Object.fromEntries(
    Object.entries(records).flatMap(([filePath, issues]) => {
      const targetIssues = Object.fromEntries(
        Object.entries(issues).filter(([, issue]) =>
          isTargetPath(issue.filePath ?? filePath),
        ),
      );

      return Object.keys(targetIssues).length > 0
        ? [[filePath, targetIssues]]
        : [];
    }),
  );

const countIssueRecords = (records) =>
  Object.values(records).reduce(
    (total, issues) => total + Object.keys(issues).length,
    0,
  );

export const createTargetRatchet = ({ projectRoot }) => {
  const { isTargetPath } = createTargetPolicy({ projectRoot });

  return (data) => {
    const issues = { ...data.issues };

    for (const [issueType, issueCollection] of Object.entries(issues)) {
      issues[issueType] = filterIssueRecords(issueCollection, isTargetPath);
      data.counters[issueType] = countIssueRecords(issues[issueType]);
    }

    return {
      ...data,
      issues,
      configurationHints: [],
    };
  };
};

export default createTargetRatchet({ projectRoot: defaultProjectRoot });
