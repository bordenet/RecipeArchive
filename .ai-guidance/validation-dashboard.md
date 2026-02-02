# Validation Dashboard

The monorepo validator features a real-time terminal UI with structured logging.

## Features

- **Progress dashboard**: Static display with labeled sections (Prerequisites, Dependencies, P1, Mobile, Tools, Infra)
- **Red-to-green gradient**: Progress bars transition from red (0%) to green (100%)
- **Periodic updates**: Dashboard refreshes every 2 seconds during long-running validations
- **Structured logging**: All validation output captured in `.validation-logs/` directory
- **Real-time errors**: Failures display immediately with log file paths
- **Clean summary**: Final status with pass/fail counts and total time

See [docs/validation-dashboard-design.md](../docs/validation-dashboard-design.md) for complete design documentation.

## Infrastructure Validation Protocol

When making infrastructure changes, ALWAYS:

1. Run deployment scripts completely
2. Validate ALL Lambda function environment variables
3. Test end-to-end functionality via app
4. Check SQS queues, triggers, and Lambda event mappings
5. Monitor CloudWatch logs for integration errors
6. Use `./validate-monorepo.sh --all` for comprehensive validation

## Quality Gates

- Always run `./validate-monorepo.sh --all` before GitHub push
- Test multi-file Go builds: `go build -o bootstrap *.go` in function directories
- Pre-commit hooks include comprehensive compilation validation for all components
- Do not bypass Husky checks

