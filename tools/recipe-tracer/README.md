# Recipe Tracer

An end-to-end tracing tool for RecipeArchive that tracks recipe processing through S3, SQS, and CloudWatch logs.

## Usage

```bash
# Run from the recipe-tracer directory
go run *.go -recipe RECIPE_ID

# Example
go run *.go -recipe 0281c140-8708-4bbb-ac6d-d33797e34104
```

## What It Traces

- **S3 Operations**: Recipe object creation and updates
- **SQS Messages**: Normalization queue activity
- **CloudWatch Logs**: Lambda function processing logs across multiple log groups
- **Timeline**: Chronological view of all events
- **Summary**: Processing status, error count, normalization runs

## Environment Requirements

The tool reads from your `.env` file (looks in current directory or `../../.env`):

```env
AWS_REGION=us-west-2
AWS_PROFILE=your-profile
S3_STORAGE_BUCKET=your-bucket-name
NORMALIZATION_QUEUE_URL=your-queue-url
```

## Output Sections

1. **Trace Summary**: Status, processing steps, error count
2. **Current Recipe State**: Title, ingredients, cooking methods, quality score
3. **Timeline**: Chronological events across all services
4. **S3 Operations**: Object storage operations
5. **SQS Messages**: Queue message flow (if available)
6. **CloudWatch Logs**: Detailed function execution logs

## Features

- ✅ **Short modular files** - No 500+ line main.go
- ✅ **Comprehensive tracing** - S3, SQS, CloudWatch integration
- ✅ **Clear timeline** - Chronological event visualization
- ✅ **Error detection** - Automatic error identification
- ✅ **Status tracking** - Recipe processing state analysis
- ✅ **Quality metrics** - Normalization quality scores

## File Structure

- `main.go` - Entry point and CLI interface (133 lines)
- `env.go` - Environment variable loading (58 lines)
- `aws.go` - AWS client initialization (33 lines)
- `types.go` - Data structures (87 lines)
- `tracer.go` - Core tracing logic (245 lines)
- `timeline.go` - Timeline building (145 lines)
- `display.go` - Output formatting (245 lines)

Total: ~946 lines across 7 focused files instead of one massive file.