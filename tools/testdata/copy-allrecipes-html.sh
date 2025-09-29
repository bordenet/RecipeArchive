#!/bin/bash

################################################################################
#
# Copy AllRecipes HTML Fixture
#
# PURPOSE:
#   This script copies a cached HTML file from the system's temporary
#   directory to the `tools/testdata` directory. This is useful for
#   inspecting the HTML of a recipe for parser development.
#
# USAGE:
#   ./tools/testdata/copy-allrecipes-html.sh
#
# NOTES:
#   - This script assumes the cached file exists at the specified path.
#
################################################################################

# Copy the cached AllRecipes HTML into the workspace for parser inspection
target_dir="tools/testdata"
target_file="$target_dir/allrecipes_margarita.html"
mkdir -p "$target_dir"
cp /tmp/recipearchive-cache/allrecipes_https___www_allrecipes_com_recipe_16229_margaritas_.html "$target_file"
echo "Copied to $target_file"
