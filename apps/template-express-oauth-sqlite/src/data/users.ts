import { hashSync } from "bcryptjs";
import type { OAuthUser } from "mcpresso-oauth-server";

export interface DemoUser extends OAuthUser {
  hashedPassword: string;
  profile: {
    name: string;
    role: string;
    department: string;
  };
}

// // Passwords: alice@example.com => alice123, bob@example.com => bob123
// export const demoUsers: DemoUser[] = [
//   {
//     id: "user-1",
//     username: "alice@example.com",
//     email: "alice@example.com",
//     hashedPassword: hashSync("alice123", 10),
//     scopes: ["read", "write"],
//     createdAt: new Date(),
//     updatedAt: new Date(),
//     profile: { name: "Alice", role: "Engineer", department: "Engineering" },
//   },
//   {
//     id: "user-2",
//     username: "bob@example.com",
//     email: "bob@example.com",
//     hashedPassword: hashSync("bob123", 10),
//     scopes: ["read"],
//     createdAt: new Date(),
//     updatedAt: new Date(),
//     profile: { name: "Bob", role: "Marketer", department: "Marketing" },
//   },
// ]; 