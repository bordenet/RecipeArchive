package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
	"github.com/google/uuid"
)

type MobileShareFailure struct {
	EventType      string `json:"event_type"`
	URL            string `json:"url"`
	ErrorType      string `json:"error_type"`
	ErrorDetails   string `json:"error_details,omitempty"`
	Platform       string `json:"platform"`
	AppVersion     string `json:"app_version"`
	UserID         string `json:"user_id"`
	Timestamp      string `json:"timestamp"`
	BrowserContext string `json:"browser_context,omitempty"`
}

var validErrorTypes = map[string]bool{
	"invalid_url":     true,
	"network_timeout": true,
	"parse_failure":   true,
	"unknown_error":   true,
}

var s3New = func(sess *session.Session) s3iface.S3API {
	return s3.New(sess)
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var payload MobileShareFailure
	err := json.Unmarshal([]byte(request.Body), &payload)
	if err != nil {
		return events.APIGatewayProxyResponse{Body: "Invalid JSON", StatusCode: 400}, nil
	}

	if err := validatePayload(payload); err != nil {
		return events.APIGatewayProxyResponse{Body: err.Error(), StatusCode: 400}, nil
	}

	if err := storeDiagnostic(payload); err != nil {
		return events.APIGatewayProxyResponse{Body: err.Error(), StatusCode: 500}, nil
	}

	return events.APIGatewayProxyResponse{StatusCode: 200}, nil
}

func validatePayload(payload MobileShareFailure) error {
	if payload.EventType != "mobile_share_failure" {
		return fmt.Errorf("event_type is not mobile_share_failure")
	}
	if payload.URL == "" {
		return fmt.Errorf("url is required")
	}
	if _, err := url.ParseRequestURI(payload.URL); err != nil {
		return fmt.Errorf("url is not a valid url")
	}
	if payload.ErrorType == "" {
		return fmt.Errorf("error_type is required")
	}
	if !validErrorTypes[payload.ErrorType] {
		return fmt.Errorf("error_type is not a valid error_type")
	}
	if payload.Platform == "" {
		return fmt.Errorf("platform is required")
	}
	return nil
}

func storeDiagnostic(payload MobileShareFailure) error {
	sess := session.Must(session.NewSession())
	svc := s3New(sess)

	bucket := os.Getenv("DIAGNOSTICS_BUCKET")
	if bucket == "" {
		return fmt.Errorf("DIAGNOSTICS_BUCKET environment variable not set")
	}

	now := time.Now().UTC()
	key := fmt.Sprintf("mobile-share-failures/%d/%02d/%02d/%02d/%s.json", now.Year(), now.Month(), now.Day(), now.Hour(), uuid.New().String())

	bytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = svc.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		Body:   strings.NewReader(string(bytes)),
	})

	return err
}

func main() {
	lambda.Start(handler)
}