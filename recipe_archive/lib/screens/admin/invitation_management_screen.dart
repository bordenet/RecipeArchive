import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../services/admin_service.dart';
import '../../models/invitation.dart';

class InvitationManagementScreen extends ConsumerStatefulWidget {
  const InvitationManagementScreen({super.key});

  @override
  ConsumerState<InvitationManagementScreen> createState() => _InvitationManagementScreenState();
}

class _InvitationManagementScreenState extends ConsumerState<InvitationManagementScreen> {
  final _emailController = TextEditingController();
  final _messageController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  
  bool _isCreating = false;
  String? _createdInvitationLink;

  @override
  void dispose() {
    _emailController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final invitationsAsync = ref.watch(invitationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Invitation Management'),
        backgroundColor: Colors.red.shade600,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Create Invitation Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Create New Invitation',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _emailController,
                        decoration: const InputDecoration(
                          labelText: 'Email Address',
                          hintText: 'user@example.com',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.emailAddress,
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Email is required';
                          }
                          if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                            return 'Please enter a valid email address';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _messageController,
                        decoration: const InputDecoration(
                          labelText: 'Personal Message (Optional)',
                          hintText: 'Add a personal note to the invitation...',
                          border: OutlineInputBorder(),
                        ),
                        maxLines: 3,
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _isCreating ? null : _createInvitation,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red.shade600,
                            foregroundColor: Colors.white,
                          ),
                          child: _isCreating
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Create Invitation'),
                        ),
                      ),
                      
                      // Show created invitation link
                      if (_createdInvitationLink != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.green.shade50,
                            border: Border.all(color: Colors.green.shade200),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.check_circle, color: Colors.green.shade600),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Invitation Created Successfully!',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Colors.green.shade700,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              const Text('Invitation Link:'),
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        _createdInvitationLink!,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontFamily: 'monospace',
                                        ),
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.copy),
                                      onPressed: () {
                                        Clipboard.setData(
                                          ClipboardData(text: _createdInvitationLink!),
                                        );
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(
                                            content: Text('Invitation link copied to clipboard!'),
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Invitations List
            Text(
              'Existing Invitations',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            
            Expanded(
              child: invitationsAsync.when(
                data: (invitations) => _buildInvitationsList(invitations),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, stack) => Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.red),
                      const SizedBox(height: 16),
                      Text('Failed to load invitations'),
                      const SizedBox(height: 8),
                      Text(error.toString(), style: const TextStyle(fontSize: 12)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () {
                          // ignore: unused_result
                          ref.refresh(invitationsProvider);
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInvitationsList(List<InvitationToken> invitations) {
    if (invitations.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.mail_outline, size: 48, color: Colors.grey),
            SizedBox(height: 16),
            Text('No invitations created yet'),
            SizedBox(height: 8),
            Text(
              'Create your first invitation above to invite users to Recipe Archive',
              style: TextStyle(color: Colors.grey),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        // ignore: unused_result
        ref.refresh(invitationsProvider);
      },
      child: ListView.builder(
        itemCount: invitations.length,
        itemBuilder: (context, index) {
          final invitation = invitations[index];
          return _buildInvitationCard(invitation);
        },
      ),
    );
  }

  Widget _buildInvitationCard(InvitationToken invitation) {
    final isExpired = DateTime.fromMillisecondsSinceEpoch(invitation.expiresAt * 1000)
        .isBefore(DateTime.now());
    final statusColor = _getStatusColor(invitation.status, isExpired);
    final statusText = _getStatusText(invitation.status, isExpired);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        invitation.email,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Created ${_formatDate(invitation.createdAt)}',
                        style: const TextStyle(color: Colors.grey),
                      ),
                      Text(
                        'Expires ${_formatDate(invitation.expiresAt)}',
                        style: const TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: statusColor),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(
                      color: statusColor,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (invitation.status == 'pending' && !isExpired) ...[
                  TextButton.icon(
                    onPressed: () => _revokeInvitation(invitation),
                    icon: const Icon(Icons.cancel, size: 16),
                    label: const Text('Revoke'),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.red,
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                TextButton.icon(
                  onPressed: () => _deleteInvitation(invitation),
                  icon: const Icon(Icons.delete_forever, size: 16),
                  label: const Text('Delete'),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.red.shade700,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status, bool isExpired) {
    if (isExpired) return Colors.orange;
    switch (status) {
      case 'pending':
        return Colors.blue;
      case 'used':
        return Colors.green;
      case 'expired':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  String _getStatusText(String status, bool isExpired) {
    if (isExpired && status == 'pending') return 'EXPIRED';
    switch (status) {
      case 'pending':
        return 'PENDING';
      case 'used':
        return 'ACCEPTED';
      case 'expired':
        return 'EXPIRED';
      default:
        return status.toUpperCase();
    }
  }

  String _formatDate(int timestamp) {
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp * 1000);
    return DateFormat('MMM d, y').format(date);
  }

  Future<void> _createInvitation() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isCreating = true;
      _createdInvitationLink = null;
    });

    try {
      final adminService = ref.read(adminServiceProvider);
      final result = await adminService.createInvitation(
        email: _emailController.text.trim(),
        message: _messageController.text.trim().isEmpty 
            ? null 
            : _messageController.text.trim(),
      );

      setState(() {
        _createdInvitationLink = result.invitationLink;
      });

      // Clear form
      _emailController.clear();
      _messageController.clear();

      // Refresh invitations list
      // ignore: unused_result
      ref.refresh(invitationsProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invitation created and email sent!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      String errorMessage = 'Failed to create invitation.';
      if (e is Exception) {
        errorMessage = e.toString().replaceFirst('Exception: ', '');
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create invitation: $errorMessage'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      setState(() {
        _isCreating = false;
      });
    }
  }

  Future<void> _revokeInvitation(InvitationToken invitation) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Revoke Invitation'),
        content: Text(
          'Are you sure you want to revoke the invitation for ${invitation.email}? '
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final adminService = ref.read(adminServiceProvider);
      await adminService.revokeInvitation(invitation.token);

      // Refresh invitations list
      // ignore: unused_result
      ref.refresh(invitationsProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invitation revoked successfully'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to revoke invitation: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _deleteInvitation(InvitationToken invitation) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Invitation'),
        content: Text(
          'Are you sure you want to permanently delete the invitation for ${invitation.email}? '
          'This will remove it from your invitation list and cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade700),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final adminService = ref.read(adminServiceProvider);
      await adminService.deleteInvitation(invitation.token);

      // Refresh invitations list
      // ignore: unused_result
      ref.refresh(invitationsProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invitation deleted successfully'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete invitation: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}