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

node tools/testdata/fetch-recipe.cjs "https://food52.com/recipes/yellowtail-sashimi-with-nectarine-and-meyer-lemon-relish" tools/testdata/food52_yellowtail_sashimi.html
