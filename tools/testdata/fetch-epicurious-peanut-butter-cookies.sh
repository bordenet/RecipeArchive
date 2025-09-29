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

node tools/testdata/fetch-recipe.cjs "https://www.epicurious.com/recipes/food/views/3-ingredient-peanut-butter-cookies" tools/testdata/epicurious_peanut_butter_cookies.html
