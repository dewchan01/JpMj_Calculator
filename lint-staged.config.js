export default {
  '*.{ts,js,mjs}': ['eslint', 'prettier --write'],
  '*.{html,css,json,md,yml,yaml}': 'prettier --write',
  '*.cs': 'node scripts/check-staged-dotnet.mjs',
};
