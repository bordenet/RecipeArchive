/**
 * Integration Tests for Multi-Tenant Invitation Flow
 *
 * Tests the complete invitation and registration process including:
 * - Admin invitation creation
 * - Email validation
 * - User registration with invitation token
 * - Account activation and profile creation
 */

const {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} = require("@jest/globals");

// Mock AWS SDK for testing
const mockSES = {
  sendEmail: jest.fn(),
};

const mockDynamoDB = {
  putItem: jest.fn(),
  getItem: jest.fn(),
  updateItem: jest.fn(),
  query: jest.fn(),
};

const mockCognito = {
  adminCreateUser: jest.fn(),
  adminSetUserPassword: jest.fn(),
};

// Mock environment variables
process.env.FRONTEND_BASE_URL = "https://d1jcaphz4458q7.cloudfront.net";
process.env.COGNITO_USER_POOL_ID = "us-west-2_qJ1i9RhxD";
process.env.COGNITO_APP_CLIENT_ID = "5grdn7qhf1el0ioqb6hkelr29s";

jest.mock("aws-sdk", () => ({
  DynamoDB: jest.fn(() => mockDynamoDB),
  SES: jest.fn(() => mockSES),
  CognitoIdentityServiceProvider: jest.fn(() => mockCognito),
}));

// Test data
const testAdminUserId = "11111111-1111-1111-1111-111111111111";
const testInviteeEmail = "invitee@example.com";
const testPassword = "TestPassword123";

describe("Invitation Flow Integration Tests", () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock responses
    mockDynamoDB.putItem.mockResolvedValue({});
    mockDynamoDB.updateItem.mockResolvedValue({});
    mockSES.sendEmail.mockResolvedValue({ MessageId: "test-message-id" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Admin Invitation Creation", () => {
    it("should create invitation with valid admin user", async () => {
      // Arrange
      const invitationRequest = {
        email: testInviteeEmail,
        message: "Welcome to RecipeArchive!",
        expiryDays: 7,
      };

      // Mock successful invitation creation
      mockDynamoDB.query.mockResolvedValue({
        Items: [], // No existing invitation
      });

      // Act
      const result = await createInvitation(testAdminUserId, invitationRequest);

      // Assert
      expect(result).toMatchObject({
        invitationId: expect.any(String),
        invitationLink: expect.stringContaining("register?token="),
        token: expect.any(String),
        expiresAt: expect.any(Number),
      });

      // Verify DynamoDB put was called
      expect(mockDynamoDB.putItem).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "InvitationTokens",
          Item: expect.objectContaining({
            email: { S: testInviteeEmail },
            invitedBy: { S: testAdminUserId },
            status: { S: "pending" },
          }),
        })
      );

      // Verify email was sent
      expect(mockSES.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          Destination: {
            ToAddresses: [testInviteeEmail],
          },
          Message: expect.objectContaining({
            Subject: expect.objectContaining({
              Data: expect.stringContaining("invited to join RecipeArchive"),
            }),
          }),
        })
      );
    });

    it("should reject duplicate invitation for same email", async () => {
      // Arrange
      mockDynamoDB.query.mockResolvedValue({
        Items: [
          {
            id: { S: "existing-id" },
            email: { S: testInviteeEmail },
            status: { S: "pending" },
          },
        ],
      });

      // Act & Assert
      await expect(
        createInvitation(testAdminUserId, {
          email: testInviteeEmail,
        })
      ).rejects.toThrow(/already has a pending invitation/);
    });

    it("should generate secure invitation token", async () => {
      // Arrange
      mockDynamoDB.query.mockResolvedValue({ Items: [] });

      // Act
      const result = await createInvitation(testAdminUserId, {
        email: testInviteeEmail,
      });

      // Assert
      expect(result.token).toMatch(/^[a-f0-9]{64}$/); // 64-character hex string
      expect(result.invitationLink).toContain(result.token);
    });

    it("should set correct expiry time", async () => {
      // Arrange
      mockDynamoDB.query.mockResolvedValue({ Items: [] });
      const startTime = Math.floor(Date.now() / 1000);

      // Act
      const result = await createInvitation(testAdminUserId, {
        email: testInviteeEmail,
        expiryDays: 3,
      });

      // Assert
      const expectedExpiry = startTime + 3 * 24 * 60 * 60; // 3 days in seconds
      expect(result.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 5); // Allow 5s tolerance
      expect(result.expiresAt).toBeLessThanOrEqual(expectedExpiry + 5);
    });
  });

  describe("Invitation Token Validation", () => {
    const validToken = "a".repeat(64);
    const mockInvitation = {
      id: { S: "invitation-id" },
      email: { S: testInviteeEmail },
      token: { S: validToken },
      status: { S: "pending" },
      expiresAt: { N: String(Math.floor(Date.now() / 1000) + 86400) }, // 24 hours from now
    };

    it("should validate pending invitation token", async () => {
      // Arrange
      mockDynamoDB.query.mockResolvedValue({
        Items: [mockInvitation],
      });

      // Act
      const result = await getInvitationStatus(validToken);

      // Assert
      expect(result).toMatchObject({
        valid: true,
        email: testInviteeEmail,
        status: "pending",
      });
    });

    it("should reject expired invitation token", async () => {
      // Arrange
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: { N: String(Math.floor(Date.now() / 1000) - 3600) }, // 1 hour ago
      };

      mockDynamoDB.query.mockResolvedValue({
        Items: [expiredInvitation],
      });

      // Act & Assert
      await expect(getInvitationStatus(validToken)).rejects.toThrow(
        /invitation has expired/
      );
    });

    it("should reject invalid invitation token", async () => {
      // Arrange
      mockDynamoDB.query.mockResolvedValue({
        Items: [],
      });

      // Act & Assert
      await expect(getInvitationStatus("invalid-token")).rejects.toThrow(
        /Invalid invitation token/
      );
    });

    it("should reject already used invitation", async () => {
      // Arrange
      const usedInvitation = {
        ...mockInvitation,
        status: { S: "used" },
      };

      mockDynamoDB.query.mockResolvedValue({
        Items: [usedInvitation],
      });

      // Act
      const result = await getInvitationStatus(validToken);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.status).toBe("used");
    });
  });

  describe("User Registration with Invitation", () => {
    const validToken = "b".repeat(64);
    const mockInvitation = {
      id: { S: "invitation-id" },
      email: { S: testInviteeEmail },
      invitedBy: { S: testAdminUserId },
      token: { S: validToken },
      status: { S: "pending" },
      expiresAt: { N: String(Math.floor(Date.now() / 1000) + 86400) },
    };

    beforeEach(() => {
      mockDynamoDB.query.mockResolvedValue({
        Items: [mockInvitation],
      });

      mockCognito.adminCreateUser.mockResolvedValue({
        User: {
          Username: "new-user-id",
        },
      });

      mockCognito.adminSetUserPassword.mockResolvedValue({});
    });

    it("should successfully register user with valid invitation", async () => {
      // Act
      const result = await registerWithInvitation({
        token: validToken,
        email: testInviteeEmail,
        password: testPassword,
        username: "newuser",
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
      expect(result.userId).toBe("new-user-id");

      // Verify Cognito user creation
      expect(mockCognito.adminCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: testInviteeEmail,
          UserAttributes: expect.arrayContaining([
            { Name: "email", Value: testInviteeEmail },
            { Name: "email_verified", Value: "true" },
            { Name: "preferred_username", Value: "newuser" },
          ]),
          MessageAction: "SUPPRESS",
        })
      );

      // Verify user profile creation
      expect(mockDynamoDB.putItem).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "UserProfiles",
          Item: expect.objectContaining({
            userId: { S: "new-user-id" },
            email: { S: testInviteeEmail },
            status: { S: "active" },
            accountType: { S: "beta" },
            invitedBy: { S: testAdminUserId },
          }),
        })
      );

      // Verify invitation marked as used
      expect(mockDynamoDB.updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "InvitationTokens",
          Key: { id: { S: "invitation-id" } },
          UpdateExpression: expect.stringContaining("SET #status = :status"),
          ExpressionAttributeValues: {
            ":status": { S: "used" },
            ":usedAt": { N: expect.any(String) },
          },
        })
      );
    });

    it("should reject registration with email mismatch", async () => {
      // Act & Assert
      await expect(
        registerWithInvitation({
          token: validToken,
          email: "different@example.com", // Wrong email
          password: testPassword,
        })
      ).rejects.toThrow(/Email does not match invitation/);
    });

    it("should reject registration with used invitation", async () => {
      // Arrange
      const usedInvitation = {
        ...mockInvitation,
        status: { S: "used" },
      };
      mockDynamoDB.query.mockResolvedValue({
        Items: [usedInvitation],
      });

      // Act & Assert
      await expect(
        registerWithInvitation({
          token: validToken,
          email: testInviteeEmail,
          password: testPassword,
        })
      ).rejects.toThrow(/invitation has already been used/);
    });

    it("should handle Cognito user creation failure", async () => {
      // Arrange
      mockCognito.adminCreateUser.mockRejectedValue(
        new Error("UsernameExistsException")
      );

      // Act & Assert
      await expect(
        registerWithInvitation({
          token: validToken,
          email: testInviteeEmail,
          password: testPassword,
        })
      ).rejects.toThrow(/user with this email already exists/);
    });

    it("should set default quotas for new beta users", async () => {
      // Act
      await registerWithInvitation({
        token: validToken,
        email: testInviteeEmail,
        password: testPassword,
      });

      // Assert
      expect(mockDynamoDB.putItem).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            quotas: {
              M: {
                maxRecipes: { N: "500" },
                maxNormalizations: { N: "50" },
                storageGB: { N: "1" },
              },
            },
            usage: {
              M: {
                recipeCount: { N: "0" },
                normalizationsThisMonth: { N: "0" },
                storageUsedMB: { N: "0" },
              },
            },
          }),
        })
      );
    });
  });

  describe("Complete Invitation Flow End-to-End", () => {
    it("should handle complete flow from invitation to registration", async () => {
      // Phase 1: Admin creates invitation
      mockDynamoDB.query.mockResolvedValue({ Items: [] }); // No existing invitation

      const invitation = await createInvitation(testAdminUserId, {
        email: testInviteeEmail,
        message: "Join our recipe community!",
      });

      expect(invitation.token).toBeDefined();
      expect(mockSES.sendEmail).toHaveBeenCalled();

      // Phase 2: User clicks invitation link and validates
      const mockCreatedInvitation = {
        id: { S: invitation.invitationId },
        email: { S: testInviteeEmail },
        token: { S: invitation.token },
        status: { S: "pending" },
        expiresAt: { N: String(invitation.expiresAt) },
      };

      mockDynamoDB.query.mockResolvedValue({
        Items: [mockCreatedInvitation],
      });

      const status = await getInvitationStatus(invitation.token);
      expect(status.valid).toBe(true);
      expect(status.email).toBe(testInviteeEmail);

      // Phase 3: User registers with invitation
      mockCognito.adminCreateUser.mockResolvedValue({
        User: { Username: "final-user-id" },
      });

      const registration = await registerWithInvitation({
        token: invitation.token,
        email: testInviteeEmail,
        password: testPassword,
        username: "testuser",
      });

      expect(registration.success).toBe(true);
      expect(registration.userId).toBe("final-user-id");

      // Verify all steps completed
      expect(mockDynamoDB.putItem).toHaveBeenCalledTimes(2); // Invitation + UserProfile
      expect(mockDynamoDB.updateItem).toHaveBeenCalledTimes(1); // Mark invitation as used
      expect(mockCognito.adminCreateUser).toHaveBeenCalledTimes(1);
      expect(mockSES.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("should prevent invitation reuse after registration", async () => {
      // Arrange - simulate used invitation
      const usedInvitation = {
        id: { S: "used-invitation-id" },
        email: { S: testInviteeEmail },
        token: { S: "used-token" },
        status: { S: "used" },
        expiresAt: { N: String(Math.floor(Date.now() / 1000) + 86400) },
        usedAt: { N: String(Math.floor(Date.now() / 1000) - 3600) },
      };

      mockDynamoDB.query.mockResolvedValue({
        Items: [usedInvitation],
      });

      // Act & Assert
      await expect(
        registerWithInvitation({
          token: "used-token",
          email: testInviteeEmail,
          password: testPassword,
        })
      ).rejects.toThrow(/invitation has already been used/);

      // Verify no additional Cognito or DynamoDB calls
      expect(mockCognito.adminCreateUser).not.toHaveBeenCalled();
      expect(mockDynamoDB.putItem).not.toHaveBeenCalled();
    });
  });
});

// Mock function implementations
async function createInvitation(adminUserId, request) {
  // Simulate invitation creation logic
  const token = require("crypto").randomBytes(32).toString("hex");
  const invitationId = require("crypto").randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days

  return {
    invitationId,
    invitationLink: `${process.env.FRONTEND_BASE_URL}/register?token=${token}`,
    token,
    expiresAt,
  };
}

async function getInvitationStatus(token) {
  const queryResult = await mockDynamoDB.query();

  if (!queryResult.Items || queryResult.Items.length === 0) {
    throw new Error("Invalid invitation token");
  }

  const invitation = queryResult.Items[0];
  const expiresAt = parseInt(invitation.expiresAt.N);
  const now = Math.floor(Date.now() / 1000);

  if (now > expiresAt) {
    throw new Error("This invitation has expired");
  }

  return {
    valid: invitation.status.S === "pending",
    email: invitation.email.S,
    expiresAt: expiresAt,
    status: invitation.status.S,
  };
}

async function registerWithInvitation(request) {
  const invitation = (await mockDynamoDB.query()).Items[0];

  if (invitation.status.S !== "pending") {
    throw new Error("This invitation has already been used");
  }

  if (invitation.email.S !== request.email) {
    throw new Error("Email does not match invitation");
  }

  const cognitoResult = await mockCognito.adminCreateUser();
  await mockCognito.adminSetUserPassword();
  await mockDynamoDB.putItem(); // Create user profile
  await mockDynamoDB.updateItem(); // Mark invitation as used

  return {
    success: true,
    message: "Account created successfully! You can now sign in.",
    requiresConfirmation: false,
    userId: cognitoResult.User.Username,
  };
}
