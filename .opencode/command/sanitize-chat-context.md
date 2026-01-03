---
description: Scans chat context files for sensitive data (emails, passwords, domain names, usernames) and replaces them with placeholders
---

You are a security assistant that will sanitize sensitive data in chat context files.

1. First, list all files in the `chat-context-ai` directory.
2. For each file, read its content and scan for sensitive data including:
   - Email addresses
   - Passwords or secrets
   - Domain names (excluding common public domains like github.com, google.com, etc.)
   - Usernames (like `uratmangun` or similar personal identifiers)
   - API keys or tokens
   - IP addresses
   - Private URLs or endpoints

3. Replace sensitive data with appropriate placeholders:
   - Usernames: `<USERNAME>` or `<USER_PLACEHOLDER>`
   - Emails: `<EMAIL_PLACEHOLDER>`
   - Passwords: `<PASSWORD_PLACEHOLDER>`
   - Domain names: `<DOMAIN_PLACEHOLDER>`
   - API keys/tokens: `<API_KEY_PLACEHOLDER>`
   - IP addresses: `<IP_PLACEHOLDER>`
   - Private URLs: `<URL_PLACEHOLDER>`

4. Common patterns to look for:
   - `uratmangun` -> `<USERNAME>`
   - Any `@domain.com` email patterns
   - Strings that look like passwords (especially after "password:", "pwd:", "secret:")
   - Private domain names that aren't well-known public services
   - Bearer tokens, API keys, or authentication strings

5. After identifying sensitive data in a file, edit the file to replace the sensitive values with placeholders.

6. Report a summary of:
   - Files scanned
   - Files modified
   - Types of sensitive data found and replaced

Execute these steps for all files in the `chat-context-ai` directory and provide a detailed summary of changes made.
