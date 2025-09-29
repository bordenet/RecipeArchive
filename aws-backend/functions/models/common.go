package models

// API Error Response Models
type ErrorResponse struct {
	Error APIError `json:"error"`
}

type APIError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}
