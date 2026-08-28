// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// CRA's Jest 27 runtime cannot parse Axios' ESM entry. Tests use the actual
// browser CJS distribution, while production keeps the package's browser ESM
// resolution so webpack does not treat a deep `.cjs` import as a static asset.
jest.mock("axios", () =>
  jest.requireActual("axios/dist/browser/axios.cjs"),
);

afterEach(() => {
  document.getElementById("airbob-portal-root")?.remove();
});

jest.mock(
  "react-router",
  () => {
    const { TextDecoder, TextEncoder } = jest.requireActual("util");
    Object.assign(globalThis, { TextDecoder, TextEncoder });

    return jest.requireActual("../node_modules/react-router/dist/development/index.js");
  },
  { virtual: true },
);

jest.mock(
  "react-router/dom",
  () =>
    jest.requireActual(
      "../node_modules/react-router/dist/development/dom-export.js",
    ),
  { virtual: true },
);

jest.mock(
  "react-router-dom",
  () => jest.requireActual("../node_modules/react-router-dom/dist/index.js"),
  { virtual: true },
);
