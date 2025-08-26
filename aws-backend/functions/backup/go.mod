module github.com/bordenet/recipe-archive/backup

go 1.21

require (
	github.com/aws/aws-lambda-go v1.47.0
	github.com/aws/aws-sdk-go-v2 v1.24.1
	github.com/aws/aws-sdk-go-v2/config v1.26.1
	github.com/aws/aws-sdk-go-v2/service/s3 v1.47.7
	github.com/bordenet/recipe-archive/db v0.0.0
	github.com/bordenet/recipe-archive/models v0.0.0
	github.com/bordenet/recipe-archive/utils v0.0.0
)

replace github.com/bordenet/recipe-archive/db => ../db
replace github.com/bordenet/recipe-archive/models => ../models
replace github.com/bordenet/recipe-archive/utils => ../utils