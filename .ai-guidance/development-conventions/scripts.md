# Scripts & Shell Conventions

## Shell Scripts for Recurring Tasks

- **Build operations**: Use shell scripts with production-grade error handling
- **Clean builds**: Dedicated scripts (not ad-hoc commands)
- **Deployment**: Simulator/device deployments via scripts
- **AWS operations**: Backend interactions via scripts (see `scripts/aws/lambda.sh`)

### CRITICAL: Single Scripts Directory

- **ALL scripts MUST live in `./scripts/` at repository root**
- **NEVER create scripts directories inside subdirectories** (e.g., recipe_archive/scripts/)
- This reduces complexity and ensures consistent script locations
- Exception: Component-specific scripts embedded in their natural locations (e.g., `package.json` scripts)

### Required Script Elements

- `set -e` for fail-fast behavior
- Clear error messages with exit codes
- Status logging (info, success, error, warning)
- Input validation
- Usage documentation in header comments

