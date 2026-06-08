#!/usr/bin/env bash
set -e
cd r2r2r-app
npm install --legacy-peer-deps
EXPO_NO_TELEMETRY=1 CI=1 npx expo export --platform web
cp public/_redirects dist/_redirects
rm -rf ../dist
cp -r dist ../dist
