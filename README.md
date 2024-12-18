# QA Utils

This project contains scripts capable to trigger Execution flows on Sygma testnet and mainnet environments and Sprinter API calls with execution.

### Project Structure

#### Sygma Tests
- Location: `src/Sygma_Tests/`
- Contains end-to-end test flows for Sygma testnet and mainnet environments
- Includes tests for:
  - EVM to EVM fungible transfers
  - EVM to EVM GMP transfers
  - Combined fungible and GMP transfers
- The scripts are capable of running the tests with specific parameters so we can use specific scenarios for testing
- Each script has reports to the console with the results of the execution and stored in the `src/Sygma_Tests/reports` folder   

#### Sprinter API Calls with execution 
- Location: `src/Sprinter_API_Tests/`
- Contains direct API call tests for the Sprinter service
- Tests various API endpoints and functionality

### Prerequisites

Make sure you have the following installed on your system:

- Node.js (version 14.x or later)
- Yarn 

### Setup

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
# Basic usage will trigger ALL 2 ALL transfers
yarn transfer:fungible

# With specific source chains
yarn transfer:fungible -s 2,6,11

# With specific destination chains
yarn transfer:fungible -d 5,6,10

# With specific resource IDs
yarn transfer:fungible -r 0x0000000000000000000000000000000000000000000000000000000000001100

# With specific amount
yarn transfer:fungible -a 1000000000000000000

# Combining parameters
yarn transfer:fungible -s 2,6 -d 5,10 -r 0x0000000000000000000000000000000000000000000000000000000000001100 -a 1000000000000000000
```

Parameters:
- `-s, --source`: Source chain IDs (comma-separated)
- `-d, --destination`: Destination chain IDs (comma-separated)
- `-r, --resources`: Resource IDs (comma-separated)
- `-a, --amount`: Amount (comma-separated)
- if a parameter is not provided, the script will use the default values which are all the valid values for the parameter
- the amount parameter is recommended to be provided only with a sepcific resource ID so that the decimals are correctly applied

#### GMP transfers:

```bash
# Basic usage will trigger ALL 2 ALL transfers
yarn transfer:gmp

# With specific source chains
yarn transfer:fungible -s 2,6,11

# With specific destination chains
yarn transfer:fungible -d 5,6,10

# Combining parameters
yarn transfer:fungible -s 2,6 -d 5,10
```

Parameters:
- `-s, --source`: Source chain IDs (comma-separated)
- `-d, --destination`: Destination chain IDs (comma-separated)
- if a parameter is not provided, the script will use the default values which are all the valid values for the parameter

#### Fungible and GMP transfers used as ALL2ALL combinations:
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
yarn postCallContract
```

#### PostCall with Swap
Be sure to set account, amount, destination, token, whitelistedSourceChains, threshold, approvalAddress, callData, contractAddress, gasLimit and outputTokenAddress in the [PostCallWithContractCall.ts](src/Sprinter_Tests/PostCallWithContractCall.ts) file prior to running the script.

```
yarn postSwapCall
```


