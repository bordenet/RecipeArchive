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

node tools/testdata/fetch-recipe.cjs "https://www.loveandlemons.com/grilled-corn-on-the-cob/" tools/testdata/loveandlemons_grilled_corn.html
