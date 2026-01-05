export const DOCS_MARKDOWN = `# Linera Name System API Documentation

This documentation is also available as raw markdown at [\`/docs.md\`](/docs.md) for easy LLM parsing.

---

## Overview

The Linera Name System (LNS) allows you to query domain name information via a simple API. This is useful for resolving \`.linera\` domains to wallet addresses, URLs, or any custom value set by the domain owner.

---

## API Endpoint

\`\`\`
GET /api/domain/{name}
\`\`\`

Simply replace \`{name}\` with the domain name you want to look up.

### Examples

- \`/api/domain/alice\` - Look up alice.linera
- \`/api/domain/panda\` - Look up panda.linera
- \`/api/domain/alice.linera\` - Also works with .linera suffix

---

## Quick Start - Resolve a Domain

To get all information about a \`.linera\` domain:

### Request

\`\`\`
GET /api/domain/alice
\`\`\`

### Response (Success)

\`\`\`json
{
  "success": true,
  "domain": {
    "name": "alice",
    "fullName": "alice.linera",
    "owner": "0x1234567890abcdef...",
    "ownerChainId": "e476...",
    "expiration": 1735689600000000,
    "isExpired": false,
    "price": "0",
    "isForSale": false,
    "value": "0x1234567890abcdef..."
  }
}
\`\`\`

### Response (Not Found)

\`\`\`json
{
  "error": "Domain not found",
  "name": "alice",
  "available": true
}
\`\`\`

---

## Domain Fields Reference

| Field | Type | Description |
|-------|------|-------------|
| \`name\` | String | Domain name (without .linera suffix) |
| \`fullName\` | String | Full domain name (with .linera suffix) |
| \`owner\` | String | Wallet address of the domain owner |
| \`ownerChainId\` | String | Chain ID of the owner |
| \`expiration\` | Number | Expiration timestamp in microseconds |
| \`isExpired\` | Boolean | Whether the domain has expired |
| \`price\` | String | Sale price in smallest unit (if for sale) |
| \`isForSale\` | Boolean | Whether the domain is listed for sale |
| \`value\` | String | Custom value set by owner (e.g., wallet address) |

---

## Code Examples

### cURL

\`\`\`bash
curl https://your-domain.com/api/domain/alice
\`\`\`

### JavaScript / TypeScript

\`\`\`javascript
async function resolveDomain(name) {
  const response = await fetch(\`/api/domain/\${name}\`);
  const result = await response.json();
  
  if (result.success) {
    return result.domain;
  }
  
  return null; // Domain not found
}

// Usage
const domain = await resolveDomain('alice');
console.log(domain?.value); // "0x1234..." or wallet address
console.log(domain?.owner); // Owner address
console.log(domain?.isForSale); // true/false
\`\`\`

### Python

\`\`\`python
import requests

def resolve_domain(name):
    response = requests.get(f'https://your-domain.com/api/domain/{name}')
    result = response.json()
    
    if result.get('success'):
        return result.get('domain')
    
    return None  # Domain not found

# Usage
domain = resolve_domain('alice')
if domain:
    print(domain['value'])     # "0x1234..."
    print(domain['owner'])     # Owner address
    print(domain['isForSale']) # True/False
\`\`\`

### Go

\`\`\`go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
)

type Domain struct {
    Name        string \`json:"name"\`
    FullName    string \`json:"fullName"\`
    Owner       string \`json:"owner"\`
    Value       string \`json:"value"\`
    IsForSale   bool   \`json:"isForSale"\`
    Price       string \`json:"price"\`
    Expiration  int64  \`json:"expiration"\`
    IsExpired   bool   \`json:"isExpired"\`
}

type Response struct {
    Success bool   \`json:"success"\`
    Domain  Domain \`json:"domain"\`
}

func resolveDomain(name string) (*Domain, error) {
    resp, err := http.Get(fmt.Sprintf("https://your-domain.com/api/domain/%s", name))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result Response
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }

    if result.Success {
        return &result.Domain, nil
    }
    return nil, nil
}
\`\`\`

---

## Error Handling

### Error Response Format

\`\`\`json
{
  "error": "Error message",
  "details": "Additional error details"
}
\`\`\`

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success - Domain found |
| 400 | Bad request - Invalid domain name |
| 404 | Domain not found (available for registration) |
| 500 | Server error - Service unavailable |

---

## Advanced: Raw GraphQL API

For advanced use cases, you can also use the raw GraphQL endpoint:

\`\`\`
POST /api/linera
\`\`\`

### Request Body

\`\`\`json
{
  "chainId": "<REGISTRY_CHAIN_ID>",
  "applicationId": "<APPLICATION_ID>",
  "query": "query { domain(name: \\"alice\\") { value owner } }"
}
\`\`\`

### Available GraphQL Queries

- \`domain(name: String!)\` - Get domain info
- \`isAvailable(name: String!)\` - Check availability
- \`allDomains\` - List all domains
- \`registryChainId\` - Get registry chain ID

---

## Rate Limiting

The API is subject to standard rate limiting. For high-volume usage, consider running your own Linera node.

---

## Support

For questions or issues, please open an issue on the GitHub repository.
`;
