**QA Utils**

This project contains Cypress E2E tests for Sprinter, specifically testing the GET request functionality in the sprinter_GET_testnet.cy.ts file.

**Getting Started**

*Prerequisites*

Make sure you have the following installed on your system:

Node.js (version 14.x or later)
Yarn
Cypress installed either globally or locally within your project

*Setup*

To get started with running Cypress tests from this repository, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/sygmaprotocol/qa-utils.git
   ```

2. Navigate to project directory:
   ```bash
   cd qa-utils
   ```

3. Switch to utils branch:
   ```bash
   git checkout utils
   ```

4. Install dependencies:
   ```bash
   yarn install
   ```

*Run Cypress Tests*

You can run the sprinter_GET_testnet.cy.ts tests using the following commands:

*Running Tests in Headless Mode(using Electron by default)*

For all the GET tests
```
yarn cypress:run:GET 
```
For all the POST tests
```
yarn cypress:run:POST 
```
For all the Sprinter tests
```
yarn cypress:run:TESTS 
```

*Running Tests in the Cypress Test Runner (GUI)*

If you prefer to run the tests in the Cypress Test Runner for debugging:
```
yarn cypress:open
```

This will open the Cypress Test Runner, and you can manually select sprinter_GET_testnet.cy.ts from the UI.

*Running Tests in Specific Browsers*

You can also run the tests in specific browsers in headless mode. For example, to run the tests in Chrome:
```
yarn cypress run --spec cypress/e2e/sprinter_GET_testnet.cy.ts --browser chrome
```
