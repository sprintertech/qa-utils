import 'cypress-plugin-api';
/// <reference types="cypress" />

describe('Sprinter API Testing on Testnet for all GET calls', () => {
  const baseUrl = 'https://api.test.sprinter.buildwithsygma.com';
  let params: any;

  beforeEach(() => {
    cy.viewport(1000, 800);
    cy.fixture('params_GET').then((data) => {
      params = data;
    }); 
  });

  it('GET request /health', () => {
    const apiUrl = `${baseUrl}/health`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)

      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('status').and.equal('ok'); 
    });
  });

  it('GET request /networks', () => {
    const apiUrl = `${baseUrl}/networks`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)

      // Assertions
      expect(response.status).to.eq(200); 

      const network_sep = response.body.data.find(
        (item: { chainID: number }) => 
            item.chainID === params.sepolia_chainID
      )?.name;

      const network_base = response.body.data.find(
        (item: { chainID: number }) => 
          item.chainID === params.base_chainID
      )?.name;

      const network_b3 = response.body.data.find(
        (item: { chainID: number }) => 
          item.chainID === params.b3_chainID
      )?.name;
 

      expect(network_b3).to.be.equal(`B3Sepolia`)
      expect(network_sep).to.be.equal(`Sepolia`)
      expect(network_base).to.be.equal(`BaseSepolia`)

    });
  });

  it('GET request assets/fungible', () => {
    const apiUrl = `${baseUrl}/assets/fungible`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('data'); 
      const name_USDC = response.body.data[0].name;
      const name_WETH = response.body.data[1].name;
      expect(name_USDC).to.exist.and.be.equal('USDC');
      expect(name_WETH).to.exist.and.be.equal('Wrapped ETH');
      
      const address_usdc_sep = response.body.data.find(
        (item: { name: string }) => item.name === name_USDC
      )?.addresses[params.sepolia_chainID];
      const address_usdc_base = response.body.data.find(
        (item: { name: string }) => item.name === name_USDC
      )?.addresses[params.base_chainID];
      const address_usdc_b3 = response.body.data.find(
        (item: { name: string }) => item.name === name_USDC
      )?.addresses[params.b3_chainID];

      expect(address_usdc_sep).to.exist.and.be.equal('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238');
      expect(address_usdc_base).to.exist.and.be.equal('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
      expect(address_usdc_b3).to.exist.and.be.equal('0xE61e5ed4c4f198c5384Ef57E69aAD1eF0c911004');

    });
  });
  
  it('GET request /accounts/{account}/assets/native', () => {
    const apiUrl = `${baseUrl}/accounts/${params.test_wallet_assertions}/assets/native`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('data'); 
      const chainId = response.body.data[0].chainId;

      const balanceB3 = Number(response.body.data.find(
        (item: { chainId: number }) => item.chainId === params.b3_chainID
      )?.balance);
      const balanceSep = Number(response.body.data.find(
        (item: { chainId: number }) => item.chainId === params.sepolia_chainID
      )?.balance);
      const balanceBase = Number(response.body.data.find(
        (item: { chainId: number }) => item.chainId === params.base_chainID
      )?.balance);

      expect(balanceB3).to.be.equal(params.amount_eth_b3)
      expect(balanceSep).to.be.equal(params.amount_eth_sepolia)
      expect(balanceBase).to.be.equal(params.amount_eth_base)
    });
  });

  it('Negative - GET request /accounts/{account}/assets/native with bad account format missing one character', () => {
    const apiUrl = `${baseUrl}/accounts/0x9A17FA0A2824EA855EC6aD3eAb3Aa2516EC6626/assets/native`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(400); 
      
    });
  });

  it('Negative - GET request /accounts/{account}/assets/native with bad account format polkadot format', () => {
      const apiUrl = `${baseUrl}/accounts/5GjowPEaFNnwbrmpPuDmBVdF2e7n3cHwk2LnUwHXsaW5KtEL/assets/native`
      cy.api({
        method: 'GET',
        url: apiUrl,
        failOnStatusCode: false
      }).then((response) => {
        cy.log(JSON.stringify(response.body));
        cy.log('Response Status:', response.status.toString());
        cy.log('Response Headers:', JSON.stringify(response.headers))
        cy.log(`x-request-id: ${response.headers['x-request-id']}`)
       
        // Assertions
        expect(response.status).to.eq(400); 
        
      });
    });
  
  it('GET request assets/fungible/{token} = USDC', () => {
    const apiUrl = `${baseUrl}/assets/fungible/usdc`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('addresses'); 
      console.log("This is address for sep", response.body.addresses)

      expect(response.body.addresses[params.sepolia_chainID]).to.be.equal(params.sep_USDC_contract);
      expect(response.body.addresses[params.base_chainID]).to.be.equal(params.base_USDC_contract);
      expect(response.body.addresses[params.b3_chainID]).to.be.equal(params.b3_USDC_contract);

    });
  });

  it('GET request assets/fungible/{token} = WETH', () => {
    const apiUrl = `${baseUrl}/assets/fungible/weth`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('addresses'); 
      console.log("This is address for sep", response.body.addresses)

      const address_usdc_sep = response.body.addresses[params.sepolia_chainID]
      const address_usdc_base = response.body.addresses[params.base_chainID]
      const address_usdc_b3 = response.body.addresses[params.b3_chainID]

      // const address_usdc_base = response.body.data.find(
      //   (item: { name: string }) => item.name === name_USDC
      // )?.addresses[params.destination_base];
      // const address_usdc_b3 = response.body.data.find(
      //   (item: { name: string }) => item.name === name_USDC
      // )?.addresses[params.destination_b3];

      expect(response.body.addresses[params.sepolia_chainID]).to.be.oneOf([params.sep_SYGMA_WETH_contract, params.sep_SPRINTER_WETH_contract]);
      expect(response.body.addresses[params.base_chainID]).to.be.equal(params.base_WETH_contract);
      expect(response.body.addresses[params.b3_chainID]).to.be.equal(params.b3_WETH_contract);

    });
  });

  // ETH not yet added as fungible
  it.skip('GET request assets/fungible/{token} = ETH', () => {
    const apiUrl = `${baseUrl}/assets/fungible/ETH`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('addresses'); 
      console.log("This is address for sep", response.body.addresses)

      // const address_usdc_sep = response.body.addresses[params.sepolia_chainID]
      // const address_usdc_base = response.body.addresses[params.base_chainID]
      // const address_usdc_b3 = response.body.addresses[params.b3_chainID]

      // const address_usdc_base = response.body.data.find(
      //   (item: { name: string }) => item.name === name_USDC
      // )?.addresses[params.destination_base];
      // const address_usdc_b3 = response.body.data.find(
      //   (item: { name: string }) => item.name === name_USDC
      // )?.addresses[params.destination_b3];

      expect(response.body.addresses[params.sepolia_chainID]).to.be.equal('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238');
      expect( response.body.addresses[params.base_chainID]).to.be.equal('0x4200000000000000000000000000000000000006');
      expect(response.body.addresses[params.b3_chainID]).to.be.equal('0x3538f4C55893eDca690D1e4Cf9Fb61FB70cd0DD8');

    });
  });

  it('Negative - GET request assets/fungible/{token} = USDP', () => {
    const apiUrl = `${baseUrl}/assets/fungible/usdp`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(404); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`Unknown fungible token`);

 

    });
  });

  it('GET request /accounts/{account}/assets/fungible/{token} - USDC', () => {
    const apiUrl = `${baseUrl}/accounts/${params.test_wallet_assertions}/assets/fungible/${params.token}`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('data'); 
      const chainId = response.body.data[0].chainId;
      expect(chainId).to.exist;

      const balanceB3 = Number(response.body.data.find(
        (item: { chainId: number }) => item.chainId === params.b3_chainID
      )?.balance);
      const balanceSep = Number(response.body.data.find(
        (item: { chainId: number }) => item.chainId === params.sepolia_chainID
      )?.balance);
      const balanceBase = Number(response.body.data.find(
        (item: { chainId: number }) => item.chainId === params.base_chainID
      )?.balance);

      expect(balanceB3).to.be.equal(params.amount_usdc_b3)
      expect(balanceSep).to.be.equal(params.amount_usdc_sepolia)
      expect(balanceBase).to.be.equal(params.amount_usdc_base)
    });
  });

  it('GET request /networks/{chainID}/assets/fungible - Sepolia', () => {
    const apiUrl = `${baseUrl}/networks/${params.sepolia_chainID}/assets/fungible`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('data'); 
      expect(response.body.data[0].name).to.exist.and.be.equal('USDC');
      expect(response.body.data[1].name).to.exist.and.be.equal('Wrapped ETH');

      const usdcObject = response.body.data.find((item: any) => item.name === "USDC");
      const wethObject = response.body.data.find((item: any) => item.name === "Wrapped ETH");
      
      expect(usdcObject.addresses[params.sepolia_chainID]).to.be.equal(params.sep_USDC_contract);
      expect(usdcObject.addresses[params.base_chainID]).to.be.equal(params.base_USDC_contract);
      expect(usdcObject.addresses[params.b3_chainID]).to.be.equal(params.b3_USDC_contract);

      expect(wethObject.addresses[params.sepolia_chainID]).to.be.oneOf([params.sep_SYGMA_WETH_contract, params.sep_SPRINTER_WETH_contract]);
      expect(wethObject.addresses[params.base_chainID]).to.be.equal(params.base_WETH_contract);
      expect(wethObject.addresses[params.b3_chainID]).to.be.equal(params.b3_WETH_contract);
    });
  });

  it('GET request /solutions/aggregation - Sepolia to Base with USDC with all valid data', () => {
    const queryParams = new URLSearchParams({
      account:params.your_wallet,
      destination: `${params.base_chainID}`,
      token:'usdc',
      amount: '12000000',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `${params.sepolia_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('data');
      expect(response.body.data[0]).to.have.property('sourceChain').equal(params.sepolia_chainID);
      expect(response.body.data[0]).to.have.property('destinationChain').equal(params.base_chainID);
      expect(response.body.data[0].tool['name']).equal(`Sygma-Testnet`);
      expect(response.body.data[0].fee['amount']).equal(`1056000000000000`);
      expect(response.body.data[0]).to.have.property('transaction');
      expect(response.body.data[0].transaction['to']).equal(`0x4CF326d3817558038D1DEF9e76b727202c3E8492`);
      expect(response.body.data[0].transaction['value']).equal(`0x3c06d28e20000`);
      expect(response.body.data[0].transaction['chainId']).equal(params.sepolia_chainID);
      expect(response.body.data[0]).to.have.property('approvals');
      expect(response.body.data[0].approvals[0]['data']).length.above(10);
      expect(response.body.data[0].approvals[0]['to']).equal(`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`);
      expect(response.body.data[0].approvals[0]['from']).equal(`${params.your_wallet}`);
      expect(response.body.data[0].approvals[0]['value']).equal(`0x0`);
      expect(response.body.data[0].approvals[0]['chainId']).equal(params.sepolia_chainID);
  
    });
  });

  it('Negative - GET request /solutions/aggregation - Sepolia to Base with USDC with bad account format', () => {
    const queryParams = new URLSearchParams({
      account:`0xB99437c5B65e7B65429b3687cF6A4cFF482C147`,
      destination: `${params.base_chainID}`,
      token:'usdc',
      amount: '12000000',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `${params.sepolia_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(400); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`Key: 'queryParams.Account' Error:Field validation for 'Account' failed on the 'eth_address' tag`);
  
    });
  });
  
  it('Negative - GET request /solutions/aggregation - Sepolia to Base with bad token format USDP', () => {
    const queryParams = new URLSearchParams({
      account:params.test_wallet_assertions,
      destination: `${params.base_chainID}`,
      token:'usdp',
      amount: '12000000',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `${params.sepolia_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(400); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`Key: 'queryParams.Token' Error:Field validation for 'Token' failed on the 'supported_token' tag`);
  
    });
  });

  it('Negative - GET request /solutions/aggregation - Sepolia to Base with USDC with all valid data except amount > source balance', () => {
    const queryParams = new URLSearchParams({
      account:params.test_wallet_assertions,
      destination: `${params.base_chainID}`,
      token:'usdc',
      amount: '22987267',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `${params.sepolia_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(404); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`No solution found`);
  
    });
  });

  it('Negative - GET request /solutions/aggregation - Sepolia to Base with USDC with all valid data except amount === 0', () => {
    const queryParams = new URLSearchParams({
      account:params.test_wallet_assertions,
      destination: `${params.base_chainID}`,
      token:'usdc',
      amount: '0',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `${params.sepolia_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(400); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`Key: 'queryParams.Amount' Error:Field validation for 'Amount' failed on the 'big_gt' tag`);
  
    });
  });

  it('Negative - GET request /solutions/aggregation - Sepolia to Base with USDC with all valid data except amount with decimal order', () => {
    const queryParams = new URLSearchParams({
      account:params.test_wallet_assertions,
      destination: `${params.base_chainID}`,
      token:'usdc',
      amount: '0.23',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `${params.sepolia_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(400); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`math/big: cannot unmarshal \"0.23\" into a *big.Int`);
  
    });
  });

  it('Negative - GET request /solutions/aggregation - Sepolia to Base with USDC with all valid data except amount set to a string', () => {
    const queryParams = new URLSearchParams({
      account:params.test_wallet_assertions,
      destination: `${params.base_chainID}`,
      token:'usdc',
      amount: 'asdksas',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `${params.sepolia_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(400); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`invalid character 'a' looking for beginning of value`);
  
    });
  });

  it('Negative - GET request /solutions/aggregation - with invalid destination but exiting in Sygma Shared Config (338 - Cronos)', () => {
    const queryParams = new URLSearchParams({
      account:params.test_wallet_assertions,
      destination: `338`,
      token:'usdc',
      amount: '123',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `${params.sepolia_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(400); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`Key: 'queryParams.Destination' Error:Field validation for 'Destination' failed on the 'supported_chain' tag`);
  
    });
  });

  // BUG here https://github.com/ChainSafe/sprinter-api/issues/262 - > https://github.com/ChainSafe/sprinter-api/issues/257
  it.skip('Negative - GET request /solutions/aggregation - with a bad whitelisteSourceChain id (338 Cronos)', () => {
    const queryParams = new URLSearchParams({
      account:`${params.test_wallet_assertions}`,
      destination: `${params.base_chainID}`,
      token:'usdc',
      amount: '123',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `338`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(400); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`Key: 'queryParams.Destination' Error:Field validation for 'Destination' failed on the 'supported_chain' tag`);
  
    });
  });

  it('Negative - GET request /solutions/aggregation - treshold < remaining balance', () => {
    const queryParams = new URLSearchParams({
      account:params.test_wallet_assertions,
      destination: `${params.b3_chainID}`,
      token:'usdc',
      amount: '20987267',
      threshold: `2000000`,
      whitelistedSourceChains: `${params.sepolia_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
      failOnStatusCode: false
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(404); 
      expect(response.body).to.have.property('error');
      expect(response.body.error).equal(`No solution found`);
  
    });
  });

  it('GET request /solutions/aggregation - Base to B3 with ETH', () => {
    const queryParams = new URLSearchParams({
      account:params.your_wallet,
      destination: `${params.b3_chainID}`,
      token:'eth',
      amount: '1000000000000000',
      threshold: `${params.threshold}`,
      whitelistedSourceChains: `${params.base_chainID}`
    }).toString();

    const apiUrl = `${baseUrl}/solutions/aggregation?${queryParams}`
    cy.api({
      method: 'GET',
      url: apiUrl,
    }).then((response) => {
      cy.log(JSON.stringify(response.body));
      cy.log('Response Status:', response.status.toString());
      cy.log('Response Headers:', JSON.stringify(response.headers))
      cy.log(`x-request-id: ${response.headers['x-request-id']}`)
     
      // Assertions
      expect(response.status).to.eq(200); 
      expect(response.body).to.have.property('data');
      expect(response.body.data[0]).to.have.property('sourceChain').equal(params.base_chainID);
      expect(response.body.data[0]).to.have.property('destinationChain').equal(params.b3_chainID);
      expect(response.body.data[0].tool['name']).equal(`Sygma-Testnet`);
      expect(response.body.data[0].fee['amount']).equal(`1000000000000000`);
      expect(response.body.data[0]).to.have.property('transaction');
      expect(response.body.data[0].transaction['to']).equal(`0x6b3BB80A93087CF0eABb72c6a1654C979586E15B`);
      expect(response.body.data[0].transaction['value']).equal(`0x71afd498d0000`);
      expect(response.body.data[0].transaction['chainId']).equal(params.base_chainID);
      expect(response.body.data[0]).to.have.property('approvals');
      expect(response.body.data[0].approvals).is.null;      
    });
  });
  
});
