export const requireCssModuleClass = (
  className: string | undefined,
): string => {
  if (className === undefined) {
    throw new Error("A referenced CSS Module class is missing from the build.");
  }

  return className;
};
