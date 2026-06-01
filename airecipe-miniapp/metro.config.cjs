// ADR-019: Sentry 소스맵 업로드는 @granite-js/plugin-sentry(granite.config.ts)가 담당한다.
// Granite는 자체 번들러(granite dev / ait build)를 쓰므로 @sentry/react-native/metro의
// withSentryConfig(RN CLI Metro 전제)는 이 빌드 경로에서 적용되지 않는다 — 제거.
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
