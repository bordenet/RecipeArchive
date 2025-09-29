#!/bin/bash

################################################################################
#
# Fetch Recipe Fixture
#
# PURPOSE:
#   This script fetches the HTML content of a recipe and saves it as a
#   fixture for parser development and testing.
#
################################################################################

node tools/testdata/fetch-recipe.cjs "https://www.allrecipes.com/recipe/17481/simple-white-cake/" tools/testdata/allrecipes_white_cake.html
