const packages = [
  'packages/api-automation',
  'packages/common-module',
  'packages/mobile-automation',
  'packages/web-automation',
];

const quoteFiles = (files) =>
  files.map((file) => `"${file.replace(/"/g, '\\"')}"`).join(' ');

const lintCommand = (packagePath) => (files) => {
  const filesList = quoteFiles(files);
  const configPath = `${packagePath}/eslint.config.js`;

  return filesList.length
    ? `npx eslint --fix --config ${configPath} ${filesList}`
    : 'echo "No staged files for linting"';
};

const config = Object.fromEntries(
  packages.map((pkg) => [
    `${pkg}/**/*.{js,jsx,ts,tsx,mjs,cjs}`,
    lintCommand(pkg),
  ]),
);

export default config;
