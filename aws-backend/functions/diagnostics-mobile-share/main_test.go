package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
)

type mockS3Client struct {
	s3iface.S3API
	putObject func(*s3.PutObjectInput) (*s3.PutObjectOutput, error)
}

func (m *mockS3Client) PutObject(input *s3.PutObjectInput) (*s3.PutObjectOutput, error) {
	return m.putObject(input)
}

func TestMobileShareFailureHandler(t *testing.T) {
	tests := []struct {
		name           string
		payload        string
		expectedStatus int
	}{
		{
			name: "valid parse failure",
			payload: `{
				"event_type": "mobile_share_failure",
				"url": "https://example.com/recipe",
				"error_type": "parse_failure",
				"error_details": "No recipe found",
				"platform": "iOS",
				"app_version": "1.0.0",
				"user_id": "test-user-123",
				"timestamp": "2025-10-25T14:30:00Z"
			}`,
			expectedStatus: 200,
		},
		{
			name: "invalid URL",
			payload: `{
				"event_type": "mobile_share_failure",
				"url": "not-a-url",
				"error_type": "invalid_url",
				"platform": "Android"
			}`,
			expectedStatus: 400,
		},
		{
			name:           "missing required fields",
			payload:        `{"event_type": "mobile_share_failure"}`,
			expectedStatus: 400,
		},
	}

	if err := os.Setenv("DIAGNOSTICS_BUCKET", "test-bucket"); err != nil {
		t.Fatalf("Failed to set DIAGNOSTICS_BUCKET: %v", err)
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockS3 := &mockS3Client{
				putObject: func(input *s3.PutObjectInput) (*s3.PutObjectOutput, error) {
					return &s3.PutObjectOutput{}, nil
				},
			}

			oldS3New := s3New
			s3New = func(sess *session.Session) s3iface.S3API {
				return mockS3
			}
			defer func() { s3New = oldS3New }()

			request := events.APIGatewayProxyRequest{Body: tt.payload}
			response, _ := handler(context.Background(), request)

			if response.StatusCode != tt.expectedStatus {
				t.Errorf("handler() StatusCode = %v, want %v", response.StatusCode, tt.expectedStatus)
			}
		})
	}
}

func TestS3DiagnosticStorage(t *testing.T) {
	bucketName := "test-bucket"
	if err := os.Setenv("DIAGNOSTICS_BUCKET", bucketName); err != nil {
		t.Fatalf("Failed to set DIAGNOSTICS_BUCKET: %v", err)
	}

	payload := MobileShareFailure{
		EventType: "mobile_share_failure",
		URL:       "https://example.com",
		ErrorType: "parse_failure",
		Platform:  "iOS",
	}

	var capturedInput *s3.PutObjectInput
	mockS3 := &mockS3Client{
		putObject: func(input *s3.PutObjectInput) (*s3.PutObjectOutput, error) {
			capturedInput = input
			return &s3.PutObjectOutput{}, nil
		},
	}

	oldS3New := s3New
	s3New = func(sess *session.Session) s3iface.S3API {
		return mockS3
	}
	defer func() { s3New = oldS3New }()

	err := storeDiagnostic(payload)
	if err != nil {
		t.Fatalf("storeDiagnostic() error = %v, want nil", err)
	}

	if capturedInput == nil {
		t.Fatal("s3.PutObject was not called")
	}

	if *capturedInput.Bucket != bucketName {
		t.Errorf("Bucket = %q, want %q", *capturedInput.Bucket, bucketName)
	}

	now := time.Now().UTC()
	expectedKeyPrefix := fmt.Sprintf("mobile-share-failures/%d/%02d/%02d/%02d/", now.Year(), now.Month(), now.Day(), now.Hour())
	if !strings.HasPrefix(*capturedInput.Key, expectedKeyPrefix) {
		t.Errorf("Key prefix = %q, want %q", *capturedInput.Key, expectedKeyPrefix)
	}

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	buf := new(strings.Builder)
	_, err = io.Copy(buf, capturedInput.Body)
	if err != nil {
		t.Fatalf("Failed to read body: %v", err)
	}

	if buf.String() != string(body) {
		t.Errorf("Body = %q, want %q", buf.String(), string(body))
	}
}

func TestValidatePayload(t *testing.T) {
	t.Run("valid payload", func(t *testing.T) {
		payload := MobileShareFailure{
			EventType: "mobile_share_failure",
			URL:       "https://example.com",
			ErrorType: "parse_failure",
			Platform:  "iOS",
		}
		if err := validatePayload(payload); err != nil {
			t.Errorf("validatePayload() error = %v, want nil", err)
		}
	})

	t.Run("missing event_type", func(t *testing.T) {
		payload := MobileShareFailure{
			URL:       "https://example.com",
			ErrorType: "parse_failure",
			Platform:  "iOS",
		}
		if err := validatePayload(payload); err == nil {
			t.Errorf("validatePayload() error = nil, want error")
		}
	})

	t.Run("missing url", func(t *testing.T) {
		payload := MobileShareFailure{
			EventType: "mobile_share_failure",
			ErrorType: "parse_failure",
			Platform:  "iOS",
		}
		if err := validatePayload(payload); err == nil {
			t.Errorf("validatePayload() error = nil, want error")
		}
	})

	t.Run("invalid url", func(t *testing.T) {
		payload := MobileShareFailure{
			EventType: "mobile_share_failure",
			URL:       "not-a-url",
			ErrorType: "parse_failure",
			Platform:  "iOS",
		}
		if err := validatePayload(payload); err == nil {
			t.Errorf("validatePayload() error = nil, want error")
		}
	})

	t.Run("missing error_type", func(t *testing.T) {
		payload := MobileShareFailure{
			EventType: "mobile_share_failure",
			URL:       "https://example.com",
			Platform:  "iOS",
		}
		if err := validatePayload(payload); err == nil {
			t.Errorf("validatePayload() error = nil, want error")
		}
	})

	t.Run("invalid error_type", func(t *testing.T) {
		payload := MobileShareFailure{
			EventType: "mobile_share_failure",
			URL:       "https.example.com",
			ErrorType: "invalid",
			Platform:  "iOS",
		}
		if err := validatePayload(payload); err == nil {
			t.Errorf("validatePayload() error = nil, want error")
		}
	})

	t.Run("missing platform", func(t *testing.T) {
		payload := MobileShareFailure{
			EventType: "mobile_share_failure",
			URL:       "https://example.com",
			ErrorType: "parse_failure",
		}
		if err := validatePayload(payload); err == nil {
			t.Errorf("validatePayload() error = nil, want error")
		}
	})
}
