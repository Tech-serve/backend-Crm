export type Role = 'hr' | 'buyer' | 'head';

export const allowedUsers: Array<{ email: string; role: Role }> = [
  { email: 'hr@company.com',   role: 'hr'   },
  { email: 'buyer@company.com',role: 'buyer'},
  { email: 'head@company.com', role: 'head' },
];

export function findUserByEmail(email: string) {
  const e = email.trim().toLowerCase();
  return allowedUsers.find(u => u.email.toLowerCase() === e) || null;
}