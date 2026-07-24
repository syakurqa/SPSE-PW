# Test Step Format Examples

## Plain Text Format

### API Test Example
```
**Test Steps:**
1. Prepare request with valid mou_application_id, bank_code, and bank_account_number
2. Send POST request to /ssf/mou-application/{mou_application_id}/bank
3. Include valid Authorization header

**Sample cURL Request:**
curl --location 'https://api.example.com/ssf/mou-application/{mou_application_id}/bank' \
  --header 'Authorization: Bearer TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "bank_code": "014",
    "bank_account_number": "1234567890"
  }'

**Expected Results:**
- Response status: 200 OK
- Response body contains bank_name, bank_account_number, bank_account_name
```

### UI Test Example
```
**Test Steps:**
1. Navigate to login page at https://app.example.com/login
2. Enter username: testuser@example.com
3. Enter password: ValidPassword123!
4. Click "Sign In" button
5. Wait for dashboard to load

**Test Data:**
- Username: testuser@example.com
- Password: ValidPassword123!
- Browser: Chrome v120+

**Expected Results:**
- User is redirected to dashboard
- Welcome message displays user name
- Navigation menu is visible
```

## BDD/Gherkin Format

### API Test Example
```gherkin
Given valid authentication credentials are available
And the API endpoint is available at https://api.example.com/asset-pricing
When I send GET request with query parameters area_pl_id, asset_code, manufacturing_year, new_used
And I include valid Authorization header
Then the response status code should be 200
And the response should contain pricing information

Sample Request:
curl --location 'https://api.example.com/asset-pricing?area_pl_id=1&asset_code=ABC' \
  --header 'Authorization: Bearer TOKEN' \
  --header 'Content-Type: application/json'
```

### UI Test Example
```gherkin
Given I am on the login page
And I have valid credentials for user testuser@example.com
When I enter the username in the username field
And I enter the password in the password field
And I click the Sign In button
Then I should be redirected to the dashboard
And I should see a welcome message with my name
And the navigation menu should be visible
```

## Step-by-Step Format

### API Test Example
```javascript
[
  {
    description: "Send GET request with valid parameters",
    expectedResult: "Request is sent successfully",
    data: "curl --location 'https://api.example.com/asset-pricing?area_pl_id=1' --header 'Authorization: Bearer TOKEN'"
  },
  {
    description: "Verify response status code",
    expectedResult: "Status code: 200 OK"
  },
  {
    description: "Verify response contains pricing information",
    expectedResult: "Response body includes price, currency, and asset details"
  }
]
```

### UI Test Example
```javascript
[
  {
    description: "Navigate to login page",
    expectedResult: "Login page loads successfully",
    data: "URL: https://app.example.com/login"
  },
  {
    description: "Enter valid credentials",
    expectedResult: "Username and password fields are filled",
    data: "Username: testuser@example.com\nPassword: ValidPassword123!"
  },
  {
    description: "Click Sign In button",
    expectedResult: "User is authenticated and redirected to dashboard"
  },
  {
    description: "Verify dashboard elements",
    expectedResult: "Welcome message and navigation menu are visible"
  }
]
```

## Conversion Guidelines

### From Traditional to BDD
- **Preconditions** → "Given" steps
- **Actions** → "When" steps  
- **Results** → "Then" steps
- **Additional steps** → "And"/"But" steps

### For API Tests
- **MUST include curl command** in all formats
- Include full request (headers, body, query params)
- Show authentication method
- Specify content-type

### For Non-API Tests
- Include test data values
- Specify test environment (browser, OS)
- Add screenshots/evidence paths if applicable
- Note accessibility requirements
