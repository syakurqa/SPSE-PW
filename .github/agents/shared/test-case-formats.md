# Test Case Format Standards

## API Test Case Format

### Title Format
```
[HTTP_METHOD] [PATH_URL] action should expectation
```

**Examples:**
- `[POST] [/auth/login] login with valid credentials should return token and status code 200`
- `[GET] [/customers/{id}] get customer with valid ID should return customer data and status code 200`
- `[PUT] [/customers/{id}] update customer with invalid email should return status code 400`
- `[DELETE] [/customers/{id}] delete non-existent customer should return status code 404`

### Required Fields
- **Priority/Severity**: High, Medium, Low
- **Test Type**: Functional, Negative, Parameter Validation, Error Handling, Performance, Security, Contract
- **Prerequisites**: Starting state, required test data, authentication tokens
- **Steps**: Numbered, clear, actionable instructions
- **Sample Request**: Ready-to-use curl command or code snippet
- **Expected Results**: HTTP status code, response body validation, headers, side effects
- **Expected Response**: JSON/XML sample with expected structure
- **Success Criteria**: Specific checklist items

## Non-API Test Case Format

### Title Format
```
[TEST_TYPE] [MODULE/FEATURE] action should expectation
```

**Examples:**
- `[UI] [Login Form] user login with valid credentials should redirect to dashboard`
- `[FUNCTIONAL] [User Registration] new user registration should create account and send email`
- `[INTEGRATION] [Payment Processing] successful payment should update order and send confirmation`
- `[E2E] [Shopping Cart] complete checkout should create order and process payment`
- `[PERFORMANCE] [Search Results] product search should return results within 3 seconds`
- `[SECURITY] [Session Management] session should timeout after 15 minutes of inactivity`
- `[USABILITY] [Navigation] main navigation should be accessible via keyboard`

### Required Fields
- **Priority**: Critical, High, Medium, Low
- **Test Type**: UI, Functional, Integration, E2E, Performance, Usability, Security, Accessibility
- **Test Suite**: Grouping/category name
- **Assumptions**: Starting state and environment conditions
- **Prerequisites**: Setup requirements and dependencies
- **Test Environment**: Browser, OS, Device, Network conditions
- **Test Data**: Required test data with specific values
- **Steps**: Detailed user interactions and navigation
- **Expected Results**: UI elements, behavior, data validation
- **Success Criteria**: Specific checklist items
- **Cleanup**: Steps to reset test state (if needed)
- **Notes**: Additional information, known issues, edge cases

## Test Coverage Matrix

### API Testing Coverage
- Parameter validation (required, optional, type, format, length, enum)
- HTTP status codes (200, 201, 400, 401, 403, 404, 422, 500, 503)
- Request/response contract validation
- Authentication and authorization
- Rate limiting and throttling
- Idempotency and retry behavior
- Pagination and filtering
- Security (SQL injection, XSS, input sanitization)
- Special characters and Unicode handling

### UI Testing Coverage
- User interactions (click, type, select, drag-drop, hover)
- Form validation (client-side and server-side)
- Navigation flows and redirects
- Responsive design and cross-browser compatibility
- Accessibility (WCAG 2.1 AA compliance)
- Loading states and error messages
- Session management and timeout
- Visual elements and layout

### Functional Testing Coverage
- Business logic and calculations
- Workflow processes and state transitions
- User permissions and role-based access
- Data persistence across sessions
- Business rule enforcement

### Integration Testing Coverage
- Data flow between systems
- Message formats and protocols
- Timeout and retry scenarios
- Transaction boundaries
- Rollback and error recovery
- Third-party service integration
