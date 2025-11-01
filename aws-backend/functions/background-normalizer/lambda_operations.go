package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/lambda"
)

// callContentNormalizer invokes the content-normalizer Lambda function
func callContentNormalizer(ctx context.Context, lambdaClient *lambda.Client, recipe *Recipe) (*Recipe, error) {
	// Prepare the payload for content-normalizer
	payload := struct {
		Recipe *Recipe `json:"recipe"`
	}{
		Recipe: recipe,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal recipe payload: %w", err)
	}

	// Invoke the content-normalizer Lambda function
	result, err := lambdaClient.Invoke(ctx, &lambda.InvokeInput{
		FunctionName: aws.String("RecipeArchive-dev-ContentNormalizerFunction7256CD8-H9PZ1QlG31vV"),
		Payload:      payloadBytes,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to invoke content-normalizer: %w", err)
	}

	// Check for function errors
	if result.FunctionError != nil {
		return nil, fmt.Errorf("content-normalizer function error: %s", string(result.Payload))
	}

	// Parse the response
	var response struct {
		Recipe *Recipe `json:"recipe"`
		Error  string  `json:"error,omitempty"`
	}

	if err := json.Unmarshal(result.Payload, &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal content-normalizer response: %w", err)
	}

	if response.Error != "" {
		return nil, fmt.Errorf("content-normalizer returned error: %s", response.Error)
	}

	if response.Recipe == nil {
		return nil, fmt.Errorf("content-normalizer returned nil recipe")
	}

	return response.Recipe, nil
}
