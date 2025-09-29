package reporting

import (
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// listS3Objects lists all objects in a given S3 prefix
func (r *Reporter) listS3Objects(prefix string) ([]types.Object, error) {
	var objects []types.Object
	var continuationToken *string

	for {
		input := &s3.ListObjectsV2Input{
			Bucket:            aws.String(r.bucketName),
			Prefix:           aws.String(prefix),
			ContinuationToken: continuationToken,
		}

		result, err := r.s3Client.ListObjectsV2(r.ctx, input)
		if err != nil {
			return nil, fmt.Errorf("failed to list objects with prefix %s: %w", prefix, err)
		}

		objects = append(objects, result.Contents...)

		if !*result.IsTruncated {
			break
		}
		continuationToken = result.NextContinuationToken
	}

	return objects, nil
}

// getS3Object retrieves and unmarshals an S3 object into the provided interface
func (r *Reporter) getS3Object(key string, target interface{}) error {
	input := &s3.GetObjectInput{
		Bucket: aws.String(r.bucketName),
		Key:    aws.String(key),
	}

	result, err := r.s3Client.GetObject(r.ctx, input)
	if err != nil {
		return fmt.Errorf("failed to get object %s: %w", key, err)
	}
	defer result.Body.Close()

	decoder := json.NewDecoder(result.Body)
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("failed to decode object %s: %w", key, err)
	}

	return nil
}