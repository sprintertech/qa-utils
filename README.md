# QA Utils

This project contains scripts capable to execute E2E flows on Sygma testnet and mainnet environments, Sprinter API calls with execution and Cypress API tests for Sprinter, specifically testing the GET request functionality in the sprinter_GET_testnet.cy.ts file.

### Project Structure

#### Sygma Tests
- Location: `src/Sygma_Tests/`
- Contains end-to-end test flows for Sygma testnet and mainnet environments
- Includes tests for:
  - EVM to EVM fungible transfers
  - EVM to EVM GMP transfers
  - Combined fungible and GMP transfers

#### Sprinter API Tests with execution 
- Location: `src/Sprinter_API_Tests/`
- Contains direct API call tests for the Sprinter service
- Tests various API endpoints and functionality

#### Cypress Tests
- Location: `cypress/e2e/Sprinter/`
- API testing suite using Cypress
- Includes:
  - GET request tests
  - POST request tests
  - Response validation
  - Error handling scenarios

**Getting Started**

### Prerequisites

Make sure you have the following installed on your system:

- Node.js (version 14.x or later)
- Yarn 
- Cypress installed either globally or locally within your project

### Setup

To get started with running Cypress tests from this repository, follow these steps:

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
4. Populate with correct values the `.env` file. Check the `.env.example` for reference.

## Running Tests

### **Sygma Tests**

#### Fungible transfers:

The fungible transfer script supports the following optional parameters:

```bash
# Basic usage
yarn transfer:fungible

# With specific source chains
yarn transfer:fungible -s 2,6,11

# With specific destination chains
yarn transfer:fungible -d 5,6,10

# With specific resource IDs
yarn transfer:fungible -r 0x0000000000000000000000000000000000000000000000000000000000001100

# Combining parameters
yarn transfer:fungible -s 2,6 -d 5,10 -r 0x0000000000000000000000000000000000000000000000000000000000001100
```

Parameters:
- `-s, --source`: Source chain IDs (comma-separated)
- `-d, --destination`: Destination chain IDs (comma-separated)
- `-r, --resources`: Resource IDs (comma-separated)


#### GMP transfers(All2All):
```
yarn transfer:gmp
```

#### Fungible and GMP transfers(All2All):
```
yarn transfer:fungible_and_gmp
```

### **Sprinter API Tests with execution**

#### PostCall without ContractCall
Be sure to set account, amount, destination, token, whitelistedSourceChains and threshold in the [PostCallNoContractCall.ts](src/Sprinter_Tests/PostCallNoContractCall.ts) file prior to running the script.

```
yarn postCall
```
#### PostCall with ContractCall
Be sure to set account, amount, destination, token, whitelistedSourceChains, threshold, approvalAddress, callData, contractAddress, gasLimit and outputTokenAddress in the [PostCallWithContractCall.ts](src/Sprinter_Tests/PostCallWithContractCall.ts) file prior to running the script.

```
yarn postaCallContract
```   

### **Cypress Tests**

There are several ways to run the Cypress tests in this project:

### 1. Headless Mode (Default Electron Browser)

For all the GET tests
```
yarn cypress:run:get 
```
For all the POST tests
```
yarn cypress:run:post 
```
For all the Sprinter API calls tests
```
yarn ypress:run:tests 
```

### 2. Running Tests in the Cypress Test Runner (GUI)

If you prefer to run the tests in the Cypress Test Runner for debugging:
```
yarn cypress:open
```

This will open the Cypress Test Runner, and you can manually select sprinter_GET_testnet.cy.ts from the UI.

### 3. Running Tests in Specific Browsers

You can also run the tests in specific browsers in headless mode. For example, to run the tests in Chrome:
```
yarn cypress run --spec cypress/e2e/Sprinter/sprinter_GET_testnet.cy.ts --browser chrome
```


