#!/bin/bash

NEW_VERSION=$1

if [ -z "$NEW_VERSION" ]; then
  echo "Usage: ./update_version.sh <version_number>"
  echo "Example: ./update_version.sh 3.5.0"
  exit 1
fi

# 1. Update Constants.js (Internal UI string)
sed -i '' "s/export const APP_VERSION = 'V\..*';/export const APP_VERSION = 'V.$NEW_VERSION';/" src/lib/Constants.js

# 2. Update package.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json

# 3. Update app.json
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" app.json

echo "✅ Version updated to $NEW_VERSION in all 3 files!"
