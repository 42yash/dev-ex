#!/bin/bash

# Fix .js extensions in TypeScript imports for backend/gateway
echo "Fixing .js imports in backend/gateway TypeScript files..."

# Find all TypeScript files and remove .js extensions from imports
find backend/gateway/src -name "*.ts" -type f | while read file; do
    # Use sed to replace import statements with .js extensions
    sed -i "s/from '\(.*\)\.js'/from '\1'/g" "$file"
    sed -i 's/from "\(.*\)\.js"/from "\1"/g' "$file"
done

echo "Fixed .js imports in backend/gateway TypeScript files"