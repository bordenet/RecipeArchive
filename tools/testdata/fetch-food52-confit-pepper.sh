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

node tools/testdata/fetch-recipe.cjs "https://food52.com/recipes/confit-red-pepper-and-tomato-sauce-with-pasta" tools/testdata/food52_confit_pepper.html
