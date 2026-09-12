# Access model

Version: 2.0
Priority: HIGH

## Single access level

The system uses one shared access level for every authenticated user. There is no
role-based authorization and no role-management screen.

| Actor | Access |
|---|---|
| Authenticated user | All application modules and actions |
| Unauthenticated user | Public pages only; protected pages and APIs require login |

## Enforcement

Page and API access only verify authentication:

- `requireAuth()` for protected pages
- `requireApiUser()` for protected API handlers
- `middleware.ts` for the global protected-route boundary

The UI renders the same navigation and actions for every authenticated user.

Business validations remain active independently of authentication, including
financial consistency checks, audit requirements, and non-hard-delete rules.

## Removed concepts

The application no longer uses `ADMIN`, `STAFF`, or `TEACHER` as authorization
roles. Existing users remain users, but role assignment and role-based UI/API
checks are not supported.
