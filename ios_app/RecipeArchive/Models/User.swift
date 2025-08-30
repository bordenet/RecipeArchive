import Foundation

struct User: Identifiable, Codable {
    let id: String
    let email: String
    let username: String?
    let createdAt: Date
    let lastLoginAt: Date?
    
    init(id: String, email: String, username: String? = nil, createdAt: Date = Date(), lastLoginAt: Date? = nil) {
        self.id = id
        self.email = email
        self.username = username
        self.createdAt = createdAt
        self.lastLoginAt = lastLoginAt
    }
}