#!/usr/bin/env node

/**
 * CLAUDE.md Review Script
 *
 * This script runs on every commit to review CLAUDE.md and suggest pruning/consolidation
 * opportunities to keep the project guide concise and current.
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const claudeFile = join(projectRoot, "CLAUDE.md");

class ClaudeReviewer {
  constructor() {
    this.warnings = [];
    this.suggestions = [];
    this.stats = {
      totalLines: 0,
      sections: 0,
      outdatedSections: [],
      duplicateContent: [],
      verboseSections: [],
    };
  }

  review() {
    if (!existsSync(claudeFile)) {
      console.log("✅ No CLAUDE.md found - skipping review");
      return true;
    }

    const content = readFileSync(claudeFile, "utf8");
    const lines = content.split("\n");
    this.stats.totalLines = lines.length;

    this.checkLength(lines);
    this.checkSections(content);
    this.checkForOutdatedContent(content);
    this.checkForDuplicates(content);
    this.checkForVerbosity(content);

    this.reportFindings();

    // Always return true (non-blocking) - this is advisory only
    // The goal is to remind developers to consider CLAUDE.md maintenance,
    // not to block commits
    return true;
  }

  checkLength(lines) {
    this.stats.totalLines = lines.length;

    if (lines.length > 400) {
      this.warnings.push(
        `📏 CLAUDE.md is ${lines.length} lines - consider consolidating (target: <400 lines)`
      );
    } else if (lines.length > 300) {
      this.suggestions.push(
        `📏 CLAUDE.md is ${lines.length} lines - getting lengthy (target: <400 lines)`
      );
    }
  }

  checkSections(content) {
    const sections = content.match(/^#{1,3}\s+/gm) || [];
    this.stats.sections = sections.length;

    if (sections.length > 20) {
      this.warnings.push(
        `📑 ${sections.length} sections found - consider consolidating related sections`
      );
    }
  }

  checkForOutdatedContent(content) {
    const outdatedPatterns = [
      {
        pattern: /✅.*(?:complete|done|finished|ready)/gi,
        section: "Completed items that could be archived",
      },
      { pattern: /august 202[0-4]/gi, section: "Old date references" },
      {
        pattern: /\b(?:todo|fixme|hack|temporary)\b/gi,
        section: "Development artifacts",
      },
      {
        pattern: /status.*(?:in progress|blocked|waiting)/gi,
        section: "Stale status updates",
      },
    ];

    outdatedPatterns.forEach(({ pattern, section }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 3) {
        this.stats.outdatedSections.push(section);
        this.suggestions.push(
          `🗓️ Consider archiving: ${section} (${matches.length} instances)`
        );
      }
    });
  }

  checkForDuplicates(content) {
    const duplicatePatterns = [
      /aws cognito/gi,
      /safari extension/gi,
      /chrome extension/gi,
      /authentication/gi,
      /recipe extraction/gi,
    ];

    duplicatePatterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 5) {
        this.suggestions.push(
          `🔄 "${matches[0]}" mentioned ${matches.length} times - consider consolidating`
        );
      }
    });
  }

  checkForVerbosity(content) {
    const verbosePatterns = [
      { pattern: /```[\s\S]*?```/g, name: "Code blocks", threshold: 10 },
      { pattern: /^\s*-\s+/gm, name: "List items", threshold: 50 },
      { pattern: /\*\*[^*]+\*\*/g, name: "Bold text emphasis", threshold: 30 },
    ];

    verbosePatterns.forEach(({ pattern, name, threshold }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > threshold) {
        this.suggestions.push(
          `📝 ${matches.length} ${name} - consider condensing key information`
        );
      }
    });
  }

  reportFindings() {
    console.log("\n🔍 CLAUDE.md Review Report");
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log(
      `📊 Stats: ${this.stats.totalLines} lines, ${this.stats.sections} sections`
    );

    if (this.warnings.length > 0) {
      console.log("\n⚠️  WARNINGS (Action Required):");
      this.warnings.forEach((warning) => console.log(`   ${warning}`));
    }

    if (this.suggestions.length > 0) {
      console.log("\n💡 SUGGESTIONS (Consider for next cleanup):");
      this.suggestions.forEach((suggestion) => console.log(`   ${suggestion}`));
    }

    if (this.warnings.length === 0 && this.suggestions.length === 0) {
      console.log("\n✅ CLAUDE.md looks good - no immediate pruning needed");
    }

    console.log(
      "\n📋 COMMIT RULE: Review suggestions above and consider consolidating"
    );
    console.log("   • Archive completed features to reduce redundancy");
    console.log("   • Merge related sections for better organization");
    console.log("   • Remove outdated status updates and TODOs");
    console.log("   • Keep essential context, prune verbose explanations");
    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    );
  }
}

// Run the review
const reviewer = new ClaudeReviewer();
reviewer.review();

// Always exit successfully - this is an advisory script to remind developers
// to consider CLAUDE.md maintenance, not to block commits
process.exit(0);
