export default {
  '*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}': ['eslint --fix', 'prettier --write'],
  '*.{html,css,scss,json,jsonc,md,yml,yaml}': 'prettier --write',
  '*.{cs,csx}': 'dotnet csharpier format',
};
