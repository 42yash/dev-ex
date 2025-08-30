#!/bin/bash

# Fix imports to add .js extension for ESM compatibility
echo "Adding .js extensions to local imports in TypeScript files..."

# Find all TypeScript files and add .js extensions to relative imports
find src -name "*.ts" -type f | while read file; do
    # Add .js to relative imports (starting with ./ or ../)
    sed -i "s/from '\(\.\.[^']*\)'/from '\1.js'/g" "$file"
    sed -i 's/from "\(\.\.[^"]*\)"/from "\1.js"/g' "$file"
    
    # Don't add .js if it already exists
    sed -i "s/\.js\.js'/\.js'/g" "$file"
    sed -i 's/\.js\.js"/\.js"/g' "$file"
done

echo "Fixed ESM imports in TypeScript files"