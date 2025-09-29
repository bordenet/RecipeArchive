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

node tools/testdata/fetch-recipe.cjs "https://www.foodnetwork.com/recipes/food-network-kitchen/margarita-recipe-1928467" tools/testdata/foodnetwork_margarita.html
