#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    abi::WithContractAbi,
    linera_base_types::{Account, AccountOwner, Amount},
    views::{RootView, View},
    Contract, ContractRuntime,
};

use linera_name_system::{Message, Operation};
use self::state::{LineraNameSystemState, DomainRecord};

/// One year in microseconds (365 days)
const ONE_YEAR_MICROS: u64 = 365 * 24 * 60 * 60 * 1_000_000;

/// Registration/Extension fee: 0.1 LINERA per year (in attos, 10^18 attos = 1 LINERA)
const REGISTRATION_FEE: u128 = 100_000_000_000_000_000;

pub struct LineraNameSystemContract {
    state: LineraNameSystemState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(LineraNameSystemContract);

impl WithContractAbi for LineraNameSystemContract {
    type Abi = linera_name_system::LineraNameSystemAbi;
}

impl LineraNameSystemContract {
    /// Get the registry chain ID - this is always the chain where the application was created
    fn registry_chain_id(&mut self) -> linera_sdk::linera_base_types::ChainId {
        self.runtime.application_creator_chain_id()
    }

    /// Get current timestamp in microseconds
    fn current_time(&mut self) -> u64 {
        self.runtime.system_time().micros()
    }

    /// Check if a domain is expired
    fn is_expired(&mut self, record: &DomainRecord) -> bool {
        self.current_time() > record.expiration
    }

    /// Convert u128 price to Amount
    fn amount_from_u128(value: u128) -> Amount {
        Amount::from_attos(value)
    }

    /// Convert Amount to u128
    #[allow(dead_code)]
    fn amount_to_u128(amount: Amount) -> u128 {
        amount.to_attos()
    }
}

impl Contract for LineraNameSystemContract {
    type Message = Message;
    type Parameters = ();
    type InstantiationArgument = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = LineraNameSystemState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        LineraNameSystemContract { state, runtime }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        // Nothing to initialize - registry chain is derived from application_id
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        let signer = self.runtime.authenticated_signer()
            .expect("Operation must be signed");
        let owner = signer.to_string().to_lowercase();
        
        let current_chain = self.runtime.chain_id();
        let registry_chain_id = self.registry_chain_id();

        match operation {
            Operation::Register { name } => {
                // Validate domain name
                assert!(!name.is_empty(), "Domain name cannot be empty");
                assert!(name.len() <= 63, "Domain name too long");
                assert!(
                    name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'),
                    "Invalid characters in domain name"
                );

                // Get app account for receiving the registration fee
                let app_id = self.runtime.application_id();
                let app_owner: AccountOwner = app_id.forget_abi().into();

                if current_chain == registry_chain_id {
                    // We ARE the registry chain - register directly
                    let existing = self.state.domains.get(&name).await.expect("Failed to read state");
                    
                    // Check if domain exists and is not expired
                    if let Some(record) = existing {
                        if !self.is_expired(&record) {
                            panic!("Domain already registered and not expired");
                        }
                    }
                    
                    // Transfer registration fee from user to application account
                    let destination = Account {
                        chain_id: current_chain,
                        owner: app_owner,
                    };
                    self.runtime.transfer(
                        AccountOwner::CHAIN,
                        destination,
                        Self::amount_from_u128(REGISTRATION_FEE),
                    );
                    
                    // Register the domain with 1 year expiration
                    let expiration = self.current_time() + ONE_YEAR_MICROS;
                    let record = DomainRecord {
                        owner,
                        owner_chain_id: current_chain,
                        expiration,
                        price: 0,
                        value: String::new(),
                    };
                    self.state.domains.insert(&name, record).expect("Failed to register domain");
                } else {
                    // Transfer registration fee to application account on registry chain
                    let destination = Account {
                        chain_id: registry_chain_id,
                        owner: app_owner,
                    };
                    self.runtime.transfer(
                        AccountOwner::CHAIN,
                        destination,
                        Self::amount_from_u128(REGISTRATION_FEE),
                    );
                    
                    // Send registration request to registry chain with payment info
                    let message = Message::RequestRegister {
                        name,
                        owner,
                        requester_chain: current_chain,
                        payment: REGISTRATION_FEE,
                    };
                    self.runtime.send_message(registry_chain_id, message);
                }
            }
            Operation::Transfer { name, new_owner } => {
                if current_chain == registry_chain_id {
                    // We ARE the registry chain - transfer directly
                    let mut record = self.state.domains.get(&name).await
                        .expect("Failed to read state")
                        .expect("Domain not registered");
                    
                    assert!(!self.is_expired(&record), "Domain has expired");
                    assert_eq!(record.owner, owner, "Not the domain owner");
                    
                    record.owner = new_owner;
                    record.price = 0; // Reset price on transfer
                    self.state.domains.insert(&name, record).expect("Failed to transfer domain");
                } else {
                    // Send transfer request to registry chain
                    let message = Message::RequestTransfer {
                        name,
                        new_owner,
                        current_owner: owner,
                        requester_chain: current_chain,
                    };
                    self.runtime.send_message(registry_chain_id, message);
                }
            }
            Operation::Extend { name, years } => {
                assert!(years > 0 && years <= 10, "Years must be between 1 and 10");
                
                // Calculate total extension fee
                let total_fee = (years as u128) * REGISTRATION_FEE;
                
                // Get app account for receiving the extension fee
                let app_id = self.runtime.application_id();
                let app_owner: AccountOwner = app_id.forget_abi().into();
                
                if current_chain == registry_chain_id {
                    let mut record = self.state.domains.get(&name).await
                        .expect("Failed to read state")
                        .expect("Domain not registered");
                    
                    assert_eq!(record.owner, owner, "Not the domain owner");
                    
                    // Transfer extension fee from user to application account
                    let destination = Account {
                        chain_id: current_chain,
                        owner: app_owner,
                    };
                    self.runtime.transfer(
                        AccountOwner::CHAIN,
                        destination,
                        Self::amount_from_u128(total_fee),
                    );
                    
                    // Extend from current expiration or current time if expired
                    let base_time = if self.is_expired(&record) {
                        self.current_time()
                    } else {
                        record.expiration
                    };
                    record.expiration = base_time + (years as u64 * ONE_YEAR_MICROS);
                    self.state.domains.insert(&name, record).expect("Failed to extend domain");
                } else {
                    // Transfer extension fee to application account on registry chain
                    let destination = Account {
                        chain_id: registry_chain_id,
                        owner: app_owner,
                    };
                    self.runtime.transfer(
                        AccountOwner::CHAIN,
                        destination,
                        Self::amount_from_u128(total_fee),
                    );
                    
                    let message = Message::RequestExtend {
                        name,
                        owner,
                        years,
                        requester_chain: current_chain,
                        payment: total_fee,
                    };
                    self.runtime.send_message(registry_chain_id, message);
                }
            }
            Operation::SetPrice { name, price } => {
                if current_chain == registry_chain_id {
                    let mut record = self.state.domains.get(&name).await
                        .expect("Failed to read state")
                        .expect("Domain not registered");
                    
                    assert!(!self.is_expired(&record), "Domain has expired");
                    assert_eq!(record.owner, owner, "Not the domain owner");
                    
                    record.price = price;
                    self.state.domains.insert(&name, record).expect("Failed to set price");
                } else {
                    let message = Message::RequestSetPrice {
                        name,
                        owner,
                        price,
                        requester_chain: current_chain,
                    };
                    self.runtime.send_message(registry_chain_id, message);
                }
            }
            Operation::Buy { name, expected_price } => {
                // For buying domains, we need to handle payment
                // On the registry chain, we can do it directly
                // For cross-chain, we use the expected_price from frontend query
                
                assert!(expected_price > 0, "Price must be greater than 0");
                
                if current_chain == registry_chain_id {
                    // Direct purchase on registry chain
                    let record = self.state.domains.get(&name).await
                        .expect("Failed to read state")
                        .expect("Domain not registered");
                    
                    assert!(!self.is_expired(&record), "Domain has expired");
                    assert!(record.price > 0, "Domain is not for sale");
                    assert_ne!(record.owner, owner, "Cannot buy your own domain");
                    assert_eq!(record.price, expected_price, "Price has changed, please refresh");
                    
                    let price = record.price;
                    let previous_owner = record.owner.clone();
                    
                    // Transfer payment from buyer to application (escrow)
                    // The buyer's tokens go to the application's account on this chain
                    // Use AccountOwner::CHAIN as source because user's tokens are in the chain's balance
                    let app_id = self.runtime.application_id();
                    let app_owner: AccountOwner = app_id.forget_abi().into();
                    let destination = Account {
                        chain_id: current_chain,
                        owner: app_owner,
                    };
                    
                    self.runtime.transfer(
                        AccountOwner::CHAIN,  // source: the chain's balance (where user tokens are)
                        destination,
                        Self::amount_from_u128(price),
                    );
                    
                    // Credit the previous owner's balance for later withdrawal
                    let current_balance = self.state.balances.get(&previous_owner).await
                        .expect("Failed to read balance")
                        .unwrap_or(0);
                    self.state.balances.insert(&previous_owner, current_balance + price)
                        .expect("Failed to update balance");
                    
                    // Transfer ownership
                    let mut updated_record = record;
                    updated_record.owner = owner;
                    updated_record.owner_chain_id = current_chain;
                    updated_record.price = 0; // Reset price after purchase
                    self.state.domains.insert(&name, updated_record).expect("Failed to buy domain");
                } else {
                    // Cross-chain purchase:
                    // 1. Transfer tokens from buyer's chain to application account on registry chain
                    // 2. Send RequestBuy message with payment amount
                    // The frontend queries the price first and passes it as expected_price
                    
                    let app_id = self.runtime.application_id();
                    let app_owner: AccountOwner = app_id.forget_abi().into();
                    
                    // Transfer tokens to the application's account on the registry chain
                    // Use AccountOwner::CHAIN as source because user's tokens are in the chain's balance
                    let destination = Account {
                        chain_id: registry_chain_id,
                        owner: app_owner,
                    };
                    
                    self.runtime.transfer(
                        AccountOwner::CHAIN,  // source: the chain's balance (where user tokens are)
                        destination,
                        Self::amount_from_u128(expected_price),
                    );
                    
                    // Send the buy request with the payment amount
                    let message = Message::RequestBuy {
                        name,
                        buyer: owner.clone(),
                        buyer_chain: current_chain,
                        payment: expected_price,
                    };
                    
                    self.runtime.send_message(registry_chain_id, message);
                }
            }
            Operation::SetValue { name, value } => {
                assert!(value.len() <= 1024, "Value too long (max 1024 characters)");
                
                if current_chain == registry_chain_id {
                    let mut record = self.state.domains.get(&name).await
                        .expect("Failed to read state")
                        .expect("Domain not registered");
                    
                    assert!(!self.is_expired(&record), "Domain has expired");
                    assert_eq!(record.owner, owner, "Not the domain owner");
                    
                    record.value = value;
                    self.state.domains.insert(&name, record).expect("Failed to set value");
                } else {
                    let message = Message::RequestSetValue {
                        name,
                        owner,
                        value,
                        requester_chain: current_chain,
                    };
                    self.runtime.send_message(registry_chain_id, message);
                }
            }
            Operation::Withdraw => {
                if current_chain == registry_chain_id {
                    // Direct withdrawal on registry chain
                    let balance = self.state.balances.get(&owner).await
                        .expect("Failed to read balance")
                        .unwrap_or(0);
                    
                    assert!(balance > 0, "No balance to withdraw");
                    
                    // Transfer from application to the user
                    let app_id = self.runtime.application_id();
                    let app_owner: AccountOwner = app_id.forget_abi().into();
                    let destination = Account {
                        chain_id: current_chain,
                        owner: signer,  // Send to the authenticated signer
                    };
                    
                    self.runtime.transfer(
                        app_owner,  // source: the application
                        destination,
                        Self::amount_from_u128(balance),
                    );
                    
                    // Clear the balance
                    self.state.balances.remove(&owner).expect("Failed to clear balance");
                } else {
                    // Cross-chain withdrawal
                    let message = Message::RequestWithdraw {
                        owner,
                        requester_chain: current_chain,
                    };
                    self.runtime.send_message(registry_chain_id, message);
                }
            }
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        let current_chain = self.runtime.chain_id();
        let registry_chain_id = self.registry_chain_id();
        let current_time = self.current_time();

        match message {
            Message::RequestRegister { name, owner, requester_chain, payment } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process registrations");
                
                // Verify the payment matches the required fee
                let required_fee = REGISTRATION_FEE;
                
                let existing = self.state.domains.get(&name).await.expect("Failed to read state");
                
                // Check if domain exists and is not expired
                if let Some(record) = existing {
                    if current_time <= record.expiration {
                        // Registration failed - credit the payment to owner's balance for refund
                        let current_balance = self.state.balances.get(&owner).await
                            .expect("Failed to read balance")
                            .unwrap_or(0);
                        self.state.balances.insert(&owner, current_balance + payment)
                            .expect("Failed to update balance");
                        
                        let response = Message::RegistrationFailed {
                            name,
                            reason: "Domain already registered and not expired".to_string(),
                            refund_amount: payment,
                        };
                        self.runtime.send_message(requester_chain, response);
                        return;
                    }
                }
                
                // Verify payment is sufficient
                if payment < required_fee {
                    // Credit the payment to owner's balance for refund
                    let current_balance = self.state.balances.get(&owner).await
                        .expect("Failed to read balance")
                        .unwrap_or(0);
                    self.state.balances.insert(&owner, current_balance + payment)
                        .expect("Failed to update balance");
                    
                    let response = Message::RegistrationFailed {
                        name,
                        reason: format!("Insufficient payment: required {}, got {}", required_fee, payment),
                        refund_amount: payment,
                    };
                    self.runtime.send_message(requester_chain, response);
                    return;
                }
                
                // Register the domain with 1 year expiration
                let expiration = current_time + ONE_YEAR_MICROS;
                let record = DomainRecord {
                    owner,
                    owner_chain_id: requester_chain,
                    expiration,
                    price: 0,
                    value: String::new(),
                };
                self.state.domains.insert(&name, record).expect("Failed to register domain");
                let response = Message::RegistrationSuccess { name };
                self.runtime.send_message(requester_chain, response);
            }
            Message::RequestTransfer { name, new_owner, current_owner, requester_chain } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process transfers");
                
                let stored = self.state.domains.get(&name).await.expect("Failed to read state");
                match stored {
                    None => {
                        let response = Message::TransferFailed {
                            name,
                            reason: "Domain not registered".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(record) if current_time > record.expiration => {
                        let response = Message::TransferFailed {
                            name,
                            reason: "Domain has expired".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(record) if record.owner != current_owner => {
                        let response = Message::TransferFailed {
                            name,
                            reason: "Not the domain owner".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(mut record) => {
                        record.owner = new_owner.clone();
                        record.price = 0;
                        self.state.domains.insert(&name, record).expect("Failed to transfer domain");
                        let response = Message::TransferSuccess { name, new_owner };
                        self.runtime.send_message(requester_chain, response);
                    }
                }
            }
            Message::RequestExtend { name, owner, years, requester_chain, payment } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process extensions");
                
                // Calculate required fee
                let required_fee = (years as u128) * REGISTRATION_FEE;
                
                let stored = self.state.domains.get(&name).await.expect("Failed to read state");
                match stored {
                    None => {
                        // Credit the payment to owner's balance for refund
                        let current_balance = self.state.balances.get(&owner).await
                            .expect("Failed to read balance")
                            .unwrap_or(0);
                        self.state.balances.insert(&owner, current_balance + payment)
                            .expect("Failed to update balance");
                        
                        let response = Message::ExtendFailed {
                            name,
                            reason: "Domain not registered".to_string(),
                            refund_amount: payment,
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(record) if record.owner != owner => {
                        // Credit the payment to owner's balance for refund
                        let current_balance = self.state.balances.get(&owner).await
                            .expect("Failed to read balance")
                            .unwrap_or(0);
                        self.state.balances.insert(&owner, current_balance + payment)
                            .expect("Failed to update balance");
                        
                        let response = Message::ExtendFailed {
                            name,
                            reason: "Not the domain owner".to_string(),
                            refund_amount: payment,
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(record) if payment < required_fee => {
                        // Insufficient payment - credit for refund (ignore record)
                        let _ = record;
                        let current_balance = self.state.balances.get(&owner).await
                            .expect("Failed to read balance")
                            .unwrap_or(0);
                        self.state.balances.insert(&owner, current_balance + payment)
                            .expect("Failed to update balance");
                        
                        let response = Message::ExtendFailed {
                            name,
                            reason: format!("Insufficient payment: required {}, got {}", required_fee, payment),
                            refund_amount: payment,
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(mut record) => {
                        let base_time = if current_time > record.expiration {
                            current_time
                        } else {
                            record.expiration
                        };
                        record.expiration = base_time + (years as u64 * ONE_YEAR_MICROS);
                        let new_expiration = record.expiration;
                        self.state.domains.insert(&name, record).expect("Failed to extend domain");
                        let response = Message::ExtendSuccess { name, new_expiration };
                        self.runtime.send_message(requester_chain, response);
                    }
                }
            }
            Message::RequestSetPrice { name, owner, price, requester_chain } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process price updates");
                
                let stored = self.state.domains.get(&name).await.expect("Failed to read state");
                match stored {
                    None => {
                        let response = Message::SetPriceFailed {
                            name,
                            reason: "Domain not registered".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(record) if current_time > record.expiration => {
                        let response = Message::SetPriceFailed {
                            name,
                            reason: "Domain has expired".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(record) if record.owner != owner => {
                        let response = Message::SetPriceFailed {
                            name,
                            reason: "Not the domain owner".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(mut record) => {
                        record.price = price;
                        self.state.domains.insert(&name, record).expect("Failed to set price");
                        let response = Message::SetPriceSuccess { name, price };
                        self.runtime.send_message(requester_chain, response);
                    }
                }
            }
            Message::RequestBuy { name, buyer, buyer_chain, payment } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process purchases");
                
                let stored = self.state.domains.get(&name).await.expect("Failed to read state");
                match stored {
                    None => {
                        let response = Message::BuyFailed {
                            name,
                            reason: "Domain not registered".to_string(),
                            refund_amount: payment,
                        };
                        self.runtime.send_message(buyer_chain, response);
                    }
                    Some(record) if current_time > record.expiration => {
                        let response = Message::BuyFailed {
                            name,
                            reason: "Domain has expired".to_string(),
                            refund_amount: payment,
                        };
                        self.runtime.send_message(buyer_chain, response);
                    }
                    Some(record) if record.price == 0 => {
                        let response = Message::BuyFailed {
                            name,
                            reason: "Domain is not for sale".to_string(),
                            refund_amount: payment,
                        };
                        self.runtime.send_message(buyer_chain, response);
                    }
                    Some(record) if record.owner == buyer => {
                        let response = Message::BuyFailed {
                            name,
                            reason: "Cannot buy your own domain".to_string(),
                            refund_amount: payment,
                        };
                        self.runtime.send_message(buyer_chain, response);
                    }
                    Some(record) if payment < record.price => {
                        let response = Message::BuyFailed {
                            name,
                            reason: format!("Insufficient payment: required {}, got {}", record.price, payment),
                            refund_amount: payment,
                        };
                        self.runtime.send_message(buyer_chain, response);
                    }
                    Some(mut record) => {
                        let price = record.price;
                        let previous_owner = record.owner.clone();
                        
                        // Credit the previous owner's balance for later withdrawal
                        let current_balance = self.state.balances.get(&previous_owner).await
                            .expect("Failed to read balance")
                            .unwrap_or(0);
                        self.state.balances.insert(&previous_owner, current_balance + price)
                            .expect("Failed to update balance");
                        
                        // Transfer ownership
                        record.owner = buyer.clone();
                        record.owner_chain_id = buyer_chain;
                        record.price = 0;
                        self.state.domains.insert(&name, record).expect("Failed to buy domain");
                        
                        let response = Message::BuySuccess { name, new_owner: buyer };
                        self.runtime.send_message(buyer_chain, response);
                    }
                }
            }
            Message::RequestSetValue { name, owner, value, requester_chain } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process value updates");
                
                let stored = self.state.domains.get(&name).await.expect("Failed to read state");
                match stored {
                    None => {
                        let response = Message::SetValueFailed {
                            name,
                            reason: "Domain not registered".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(record) if current_time > record.expiration => {
                        let response = Message::SetValueFailed {
                            name,
                            reason: "Domain has expired".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(record) if record.owner != owner => {
                        let response = Message::SetValueFailed {
                            name,
                            reason: "Not the domain owner".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(mut record) => {
                        record.value = value;
                        self.state.domains.insert(&name, record).expect("Failed to set value");
                        let response = Message::SetValueSuccess { name };
                        self.runtime.send_message(requester_chain, response);
                    }
                }
            }
            Message::RequestWithdraw { owner, requester_chain } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process withdrawals");
                
                let balance = self.state.balances.get(&owner).await
                    .expect("Failed to read balance")
                    .unwrap_or(0);
                
                if balance == 0 {
                    let response = Message::WithdrawFailed {
                        reason: "No balance to withdraw".to_string(),
                    };
                    self.runtime.send_message(requester_chain, response);
                    return;
                }
                
                // Transfer from application to the requester chain
                let app_id = self.runtime.application_id();
                let app_owner: AccountOwner = app_id.forget_abi().into();
                
                // For cross-chain transfer, we send to the chain's account
                let destination = Account {
                    chain_id: requester_chain,
                    owner: AccountOwner::CHAIN,  // Chain account
                };
                
                self.runtime.transfer(
                    app_owner,  // source: the application
                    destination,
                    Self::amount_from_u128(balance),
                );
                
                // Clear the balance
                self.state.balances.remove(&owner).expect("Failed to clear balance");
                
                let response = Message::WithdrawSuccess { amount: balance };
                self.runtime.send_message(requester_chain, response);
            }
            // Response messages - just log them
            Message::RegistrationSuccess { name } => { let _ = name; }
            Message::RegistrationFailed { name, reason, refund_amount } => { let _ = (name, reason, refund_amount); }
            Message::TransferSuccess { name, new_owner } => { let _ = (name, new_owner); }
            Message::TransferFailed { name, reason } => { let _ = (name, reason); }
            Message::ExtendSuccess { name, new_expiration } => { let _ = (name, new_expiration); }
            Message::ExtendFailed { name, reason, refund_amount } => { let _ = (name, reason, refund_amount); }
            Message::SetPriceSuccess { name, price } => { let _ = (name, price); }
            Message::SetPriceFailed { name, reason } => { let _ = (name, reason); }
            Message::BuySuccess { name, new_owner } => { let _ = (name, new_owner); }
            Message::BuyFailed { name, reason, refund_amount } => { let _ = (name, reason, refund_amount); }
            Message::SetValueSuccess { name } => { let _ = name; }
            Message::SetValueFailed { name, reason } => { let _ = (name, reason); }
            Message::WithdrawSuccess { amount } => { let _ = amount; }
            Message::WithdrawFailed { reason } => { let _ = reason; }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}
