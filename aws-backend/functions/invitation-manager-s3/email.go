package main

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ses"
	sesTypes "github.com/aws/aws-sdk-go-v2/service/ses/types"
)

// sendInvitationEmail sends an invitation email via SES
func sendInvitationEmail(ctx context.Context, email, invitationLink, customMessage string) error {
	if customMessage == "" {
		customMessage = "You've been invited to join RecipeArchive! Click the link below to create your account."
	}

	subject := "Invitation to RecipeArchive"
	body := customMessage + "\n\n" + invitationLink + "\n\nThis invitation will expire in 7 days. If you have any questions, please reply to this email.\n\nBest regards,\nRecipeArchive Team"

	input := &ses.SendEmailInput{
		Destination: &sesTypes.Destination{
			ToAddresses: []string{email},
		},
		Message: &sesTypes.Message{
			Body: &sesTypes.Body{
				Text: &sesTypes.Content{
					Data: aws.String(body),
				},
			},
			Subject: &sesTypes.Content{
				Data: aws.String(subject),
			},
		},
		Source: aws.String("mattbordenet@hotmail.com"),
	}

	_, err := sesClient.SendEmail(ctx, input)
	return err
}
