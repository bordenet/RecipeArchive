#!/bin/bash
# Copy the cached AllRecipes HTML into the workspace for parser inspection
target_dir="tools/testdata"
target_file="$target_dir/allrecipes_margarita.html"
mkdir -p "$target_dir"
cp /tmp/recipearchive-cache/allrecipes_https___www_allrecipes_com_recipe_16229_margaritas_.html "$target_file"
echo "Copied to $target_file"
