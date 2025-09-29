import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../models/invitation.dart';
import 'auth_service.dart';

class AdminService {
  static const String baseUrl = 'https://1ym0pqnaib.execute-api.us-west-2.amazonaws.com/prod';
  
  final AuthenticationService _authService;

  AdminService(this._authService);

  // Create a new invitation
  Future<CreateInvitationResponse> createInvitation({
    required String email,
    String? message,
    int? expiryDays,
  }) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    final response = await http.post(
      Uri.parse('$baseUrl/admin/invitations'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${user.idToken}',
      },
      body: jsonEncode({
        'email': email,
        if (message != null && message.trim().isNotEmpty) 'message': message.trim(),
        if (expiryDays != null) 'expiryDays': expiryDays,
      }),
    );

    if (response.statusCode == 201) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return CreateInvitationResponse.fromJson(data);
    } else if (response.statusCode == 409) {
      final decodedBody = jsonDecode(response.body) as Map<String, dynamic>;
      final error = decodedBody['error'];
      final errorMessage = error is Map<String, dynamic>
          ? (error['message'] as String? ?? 'User already has a pending invitation')
          : (error as String? ?? 'User already has a pending invitation');
      throw Exception(errorMessage);
    } else if (response.statusCode == 401) {
      throw Exception('Authentication failed - please sign in again');
    } else {
      final decodedBody = jsonDecode(response.body) as Map<String, dynamic>;
      final error = decodedBody['error'];
      final errorMessage = error is Map<String, dynamic>
          ? (error['message'] as String? ?? 'Failed to create invitation')
          : (error as String? ?? 'Failed to create invitation');
      throw Exception(errorMessage);
    }
  }

  // List all invitations created by the current admin
  Future<List<InvitationToken>> listInvitations() async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    final response = await http.get(
      Uri.parse('$baseUrl/admin/invitations'),
      headers: {
        'Authorization': 'Bearer ${user.idToken}',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final invitations = data['invitations'] as List<dynamic>? ?? [];
      return invitations.map((json) => InvitationToken.fromJson(json)).toList();
    } else if (response.statusCode == 401) {
      throw Exception('Authentication failed - please sign in again');
    } else {
      final decodedBody = jsonDecode(response.body) as Map<String, dynamic>;
      final error = decodedBody['error'];
      final errorMessage = error is Map<String, dynamic>
          ? (error['message'] as String? ?? 'Failed to load invitations')
          : (error as String? ?? 'Failed to load invitations');
      throw Exception(errorMessage);
    }
  }

  // Revoke an invitation
  Future<void> revokeInvitation(String token) async {
    final user = _authService.currentUser;
    if (user == null) {
      throw Exception('User not authenticated');
    }

    final response = await http.delete(
      Uri.parse('$baseUrl/admin/invitations/$token'),
      headers: {
        'Authorization': 'Bearer ${user.idToken}',
      },
    );

    if (response.statusCode == 200) {
      return;
    } else if (response.statusCode == 404) {
      throw Exception('Invitation not found');
    } else if (response.statusCode == 403) {
      throw Exception('You can only revoke invitations you created');
    } else if (response.statusCode == 401) {
      throw Exception('Authentication failed - please sign in again');
    } else {
      final decodedBody = jsonDecode(response.body) as Map<String, dynamic>;
      final error = decodedBody['error'];
      final errorMessage = error is Map<String, dynamic>
          ? (error['message'] as String? ?? 'Failed to revoke invitation')
          : (error as String? ?? 'Failed to revoke invitation');
      throw Exception(errorMessage);
    }
  }

  // Delete an invitation (same as revoke, but with clearer naming for permanent deletion)
  Future<void> deleteInvitation(String token) async {
    // Delete and revoke are the same operation - completely remove from S3 storage
    return revokeInvitation(token);
  }

  // Get invitation status (for public verification)
  Future<InvitationStatus> getInvitationStatus(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/admin/invitations/status/$token'),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return InvitationStatus.fromJson(data);
    } else if (response.statusCode == 404) {
      throw Exception('Invalid invitation token');
    } else if (response.statusCode == 410) {
      throw Exception('This invitation has expired');
    } else {
      final decodedBody = jsonDecode(response.body) as Map<String, dynamic>;
      final error = decodedBody['error'];
      final errorMessage = error is Map<String, dynamic>
          ? (error['message'] as String? ?? 'Failed to check invitation status')
          : (error as String? ?? 'Failed to check invitation status');
      throw Exception(errorMessage);
    }
  }

  // Register using an invitation token
  Future<void> registerWithInvitation({
    required String token,
    required String email,
    required String password,
    String? username,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register-with-invitation'),
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'token': token,
        'email': email,
        'password': password,
        if (username != null && username.trim().isNotEmpty) 'username': username.trim(),
      }),
    );

    if (response.statusCode == 201) {
      return;
    } else if (response.statusCode == 401) {
      final error = jsonDecode(response.body);
      final message = error['error']['message'] ?? 'Invalid invitation';
      throw Exception(message);
    } else if (response.statusCode == 409) {
      throw Exception('A user with this email already exists');
    } else {
      final decodedBody = jsonDecode(response.body) as Map<String, dynamic>;
      final error = decodedBody['error'];
      final errorMessage = error is Map<String, dynamic>
          ? (error['message'] as String? ?? 'Registration failed')
          : (error as String? ?? 'Registration failed');
      throw Exception(errorMessage);
    }
  }
}

// Riverpod providers
final adminServiceProvider = Provider<AdminService>((ref) {
  final authService = ref.read(authServiceProvider);
  return AdminService(authService);
});

final invitationsProvider = FutureProvider<List<InvitationToken>>((ref) {
  final adminService = ref.read(adminServiceProvider);
  return adminService.listInvitations();
});