class InvitationToken {
  final String id;
  final String email;
  final String invitedBy;
  final String token;
  final String status; // pending, used, expired
  final int expiresAt;
  final int createdAt;
  final int? usedAt;
  final Map<String, String>? metadata;

  const InvitationToken({
    required this.id,
    required this.email,
    required this.invitedBy,
    required this.token,
    required this.status,
    required this.expiresAt,
    required this.createdAt,
    this.usedAt,
    this.metadata,
  });

  factory InvitationToken.fromJson(Map<String, dynamic> json) {
    return InvitationToken(
      id: json['id'] as String,
      email: json['email'] as String,
      invitedBy: json['invitedBy'] as String,
      token: json['token'] as String,
      status: json['status'] as String,
      expiresAt: json['expiresAt'] as int,
      createdAt: json['createdAt'] as int,
      usedAt: json['usedAt'] as int?,
      metadata: json['metadata'] != null
          ? Map<String, String>.from(json['metadata'] as Map)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'invitedBy': invitedBy,
      'token': token,
      'status': status,
      'expiresAt': expiresAt,
      'createdAt': createdAt,
      if (usedAt != null) 'usedAt': usedAt,
      if (metadata != null) 'metadata': metadata,
    };
  }

  bool get isExpired => DateTime.now().millisecondsSinceEpoch > expiresAt * 1000;
  bool get isPending => status == 'pending' && !isExpired;
  bool get isUsed => status == 'used';

  @override
  String toString() => 'InvitationToken(id: $id, email: $email, status: $status)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is InvitationToken && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}

class CreateInvitationResponse {
  final String invitationId;
  final String invitationLink;
  final String token;
  final int expiresAt;

  const CreateInvitationResponse({
    required this.invitationId,
    required this.invitationLink,
    required this.token,
    required this.expiresAt,
  });

  factory CreateInvitationResponse.fromJson(Map<String, dynamic> json) {
    return CreateInvitationResponse(
      invitationId: json['invitationId'] as String,
      invitationLink: json['invitationLink'] as String,
      token: json['token'] as String,
      expiresAt: json['expiresAt'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'invitationId': invitationId,
      'invitationLink': invitationLink,
      'token': token,
      'expiresAt': expiresAt,
    };
  }
}

class InvitationStatus {
  final bool valid;
  final String email;
  final int expiresAt;
  final String status;

  const InvitationStatus({
    required this.valid,
    required this.email,
    required this.expiresAt,
    required this.status,
  });

  factory InvitationStatus.fromJson(Map<String, dynamic> json) {
    return InvitationStatus(
      valid: json['valid'] as bool,
      email: json['email'] as String,
      expiresAt: json['expiresAt'] as int,
      status: json['status'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'valid': valid,
      'email': email,
      'expiresAt': expiresAt,
      'status': status,
    };
  }

  bool get isExpired => DateTime.now().millisecondsSinceEpoch > expiresAt * 1000;
  DateTime get expiryDate => DateTime.fromMillisecondsSinceEpoch(expiresAt * 1000);
}

class RegistrationRequest {
  final String token;
  final String email;
  final String password;
  final String? username;

  const RegistrationRequest({
    required this.token,
    required this.email,
    required this.password,
    this.username,
  });

  Map<String, dynamic> toJson() {
    return {
      'token': token,
      'email': email,
      'password': password,
      if (username != null && username!.trim().isNotEmpty) 'username': username!.trim(),
    };
  }
}

class RegistrationResponse {
  final bool success;
  final String message;
  final bool requiresConfirmation;
  final String? userId;

  const RegistrationResponse({
    required this.success,
    required this.message,
    required this.requiresConfirmation,
    this.userId,
  });

  factory RegistrationResponse.fromJson(Map<String, dynamic> json) {
    return RegistrationResponse(
      success: json['success'] as bool,
      message: json['message'] as String,
      requiresConfirmation: json['requiresConfirmation'] as bool? ?? false,
      userId: json['userId'] as String?,
    );
  }
}