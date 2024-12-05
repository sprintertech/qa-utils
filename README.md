# QA Utils - Cypress API Testing

This project contains Cypress API tests for Sprinter, primarily focused on regression testing.

## Project Structure

### Cypress API Tests
- Location: `cypress/e2e/Sprinter/`
- API testing suite using Cypress
- Includes:
  - GET request tests
  - POST request tests
  - Response validation
  - Error handling scenarios

## Prerequisites

- Node.js (version 14.x or later)
- npm or yarn
- Cypress (installed via package.json)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/sygmaprotocol/qa-utils.git
```

2. Navigate to project directory:
```bash
cd qa-utils
```

3. Install dependencies:
```bash
yarn install
```

4. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your configuration

## Running Tests

### Headless Mode

Run GET tests:
```bash
yarn cypress:run:get
```

Run POST tests:
```bash
yarn cypress:run:post
```

Run all Sprinter API tests:
```bash
yarn cypress:run:tests
```

### Interactive Mode (Cypress Test Runner)

Open Cypress Test Runner:
```bash
yarn cypress:open
```

### Running Tests in Specific Browsers

Run tests in Chrome:
```bash
yarn cypress run --spec cypress/e2e/Sprinter/sprinter_GET_testnet.cy.ts --browser chrome
```


