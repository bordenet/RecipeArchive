package db

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"

	"recipe-archive/models"
)

// DynamoRecipeDB implements RecipeDB using DynamoDB
type DynamoRecipeDB struct {
	client    *dynamodb.Client
	tableName string
}

// NewDynamoRecipeDB creates a new DynamoDB recipe database
func NewDynamoRecipeDB(client *dynamodb.Client, tableName string) *DynamoRecipeDB {
	return &DynamoRecipeDB{
		client:    client,
		tableName: tableName,
	}
}

// GetRecipe retrieves a recipe by ID and userID
func (db *DynamoRecipeDB) GetRecipe(userID, recipeID string) (*models.Recipe, error) {
	result, err := db.client.GetItem(context.TODO(), &dynamodb.GetItemInput{
		TableName: aws.String(db.tableName),
		Key: map[string]types.AttributeValue{
			"UserID": &types.AttributeValueMemberS{Value: userID},
			"ID":     &types.AttributeValueMemberS{Value: recipeID},
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to get recipe: %w", err)
	}

	if result.Item == nil {
		return nil, fmt.Errorf("recipe not found")
	}

	var recipe models.Recipe
	err = attributevalue.UnmarshalMap(result.Item, &recipe)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal recipe: %w", err)
	}

	if recipe.IsDeleted {
		return nil, fmt.Errorf("recipe not found")
	}

	return &recipe, nil
}

// ListRecipes returns recipes for a user with pagination
func (db *DynamoRecipeDB) ListRecipes(userID string, limit int) ([]models.Recipe, error) {
	result, err := db.client.Query(context.TODO(), &dynamodb.QueryInput{
		TableName:              aws.String(db.tableName),
		KeyConditionExpression: aws.String("UserID = :userId"),
		FilterExpression:       aws.String("attribute_not_exists(IsDeleted) OR IsDeleted = :false"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":userId": &types.AttributeValueMemberS{Value: userID},
			":false":  &types.AttributeValueMemberBOOL{Value: false},
		},
		Limit: aws.Int32(int32(limit)),
	})

	if err != nil {
		return nil, fmt.Errorf("failed to list recipes: %w", err)
	}

	var recipes []models.Recipe
	err = attributevalue.UnmarshalListOfMaps(result.Items, &recipes)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal recipes: %w", err)
	}

	return recipes, nil
}

// CreateRecipe adds a new recipe
func (db *DynamoRecipeDB) CreateRecipe(recipe models.Recipe) error {
	item, err := attributevalue.MarshalMap(recipe)
	if err != nil {
		return fmt.Errorf("failed to marshal recipe: %w", err)
	}

	_, err = db.client.PutItem(context.TODO(), &dynamodb.PutItemInput{
		TableName:           aws.String(db.tableName),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(ID)"),
	})

	if err != nil {
		return fmt.Errorf("failed to create recipe: %w", err)
	}

	return nil
}

// UpdateRecipe updates an existing recipe
func (db *DynamoRecipeDB) UpdateRecipe(userID, recipeID string, updates map[string]interface{}) error {
	// Build update expression
	updateExpr := "SET "
	attrNames := make(map[string]string)
	attrValues := make(map[string]types.AttributeValue)

	first := true
	for key, value := range updates {
		if !first {
			updateExpr += ", "
		}
		attrKey := fmt.Sprintf("#%s", key)
		valueKey := fmt.Sprintf(":%s", key)

		updateExpr += fmt.Sprintf("%s = %s", attrKey, valueKey)
		attrNames[attrKey] = key

		// Convert value to AttributeValue
		av, err := attributevalue.Marshal(value)
		if err != nil {
			return fmt.Errorf("failed to marshal update value: %w", err)
		}
		attrValues[valueKey] = av

		first = false
	}

	_, err := db.client.UpdateItem(context.TODO(), &dynamodb.UpdateItemInput{
		TableName: aws.String(db.tableName),
		Key: map[string]types.AttributeValue{
			"UserID": &types.AttributeValueMemberS{Value: userID},
			"ID":     &types.AttributeValueMemberS{Value: recipeID},
		},
		UpdateExpression:          aws.String(updateExpr),
		ExpressionAttributeNames:  attrNames,
		ExpressionAttributeValues: attrValues,
		ConditionExpression:       aws.String("attribute_exists(ID) AND (attribute_not_exists(IsDeleted) OR IsDeleted = :false)"),
	})

	if err != nil {
		return fmt.Errorf("failed to update recipe: %w", err)
	}

	return nil
}

// DeleteRecipe soft deletes a recipe
func (db *DynamoRecipeDB) DeleteRecipe(userID, recipeID string) error {
	_, err := db.client.UpdateItem(context.TODO(), &dynamodb.UpdateItemInput{
		TableName: aws.String(db.tableName),
		Key: map[string]types.AttributeValue{
			"UserID": &types.AttributeValueMemberS{Value: userID},
			"ID":     &types.AttributeValueMemberS{Value: recipeID},
		},
		UpdateExpression: aws.String("SET IsDeleted = :true"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":true": &types.AttributeValueMemberBOOL{Value: true},
		},
		ConditionExpression: aws.String("attribute_exists(ID) AND (attribute_not_exists(IsDeleted) OR IsDeleted = :false)"),
	})

	if err != nil {
		return fmt.Errorf("failed to delete recipe: %w", err)
	}

	return nil
}
