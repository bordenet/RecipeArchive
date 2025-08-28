#!/bin/bash
set -e  # stop on errors

SOURCE_BRANCH="web-extension-development"
TARGET_BRANCHES=("main" "aws-backend" "frontend-development")

# Ensure all commits/pushes are under the correct account
git config user.name "bordenet"
git config user.email "mattbordenet@hotmail.com"

# Use the correct remote for the bordenet account
git remote set-url origin https://bordenet@github.com/bordenet/RecipeArchive.git

# Fetch latest refs
git fetch origin

# Update source branch
git checkout $SOURCE_BRANCH
git pull origin $SOURCE_BRANCH

# Merge into each target branch and push
for BRANCH in "${TARGET_BRANCHES[@]}"; do
  echo "----------------------------------------"
  echo "Merging $SOURCE_BRANCH into $BRANCH as bordenet..."

  git checkout $BRANCH
  git pull origin $BRANCH
  git merge --no-ff $SOURCE_BRANCH -m "Merge branch '$SOURCE_BRANCH' into $BRANCH"
  git push origin $BRANCH

  echo "✅ Finished updating $BRANCH"
done

# Return to source branch
git checkout $SOURCE_BRANCH
