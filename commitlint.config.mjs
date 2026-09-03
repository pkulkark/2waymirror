export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['backend', 'frontend', 'infra', 'content', 'cli', 'ci', 'docs', 'deps']],
    'header-max-length': [2, 'always', 72],
  },
}
