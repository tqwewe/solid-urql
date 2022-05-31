module.exports = {
  preset: "solid-jest/preset/browser",
  transform: {
    '^.+\\.tsx?$': '@sucrase/jest-plugin',
  },
  clearMocks: true,
};