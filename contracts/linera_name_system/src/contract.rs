#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    abi::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use linera_name_system::{Message, Operation};
use self::state::{LineraNameSystemState, DomainRecord};

/// One year in microseconds (365 days)
const ONE_YEAR_MICROS: u64 = 365 * 24 * 60 * 60 * 1_000_000;

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
        let owner = self.runtime.authenticated_signer()
            .expect("Operation must be signed")
            .to_string();
        
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

                if current_chain == registry_chain_id {
                    // We ARE the registry chain - register directly
                    let existing = self.state.domains.get(&name).await.expect("Failed to read state");
                    
                    // Check if domain exists and is not expired
                    if let Some(record) = existing {
                        if !self.is_expired(&record) {
                            panic!("Domain already registered and not expired");
                        }
                    }
                    
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
                    // Send registration request to registry chain
                    let message = Message::RequestRegister {
                        name,
                        owner,
                        requester_chain: current_chain,
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
                
                if current_chain == registry_chain_id {
                    let mut record = self.state.domains.get(&name).await
                        .expect("Failed to read state")
                        .expect("Domain not registered");
                    
                    assert_eq!(record.owner, owner, "Not the domain owner");
                    
                    // Extend from current expiration or current time if expired
                    let base_time = if self.is_expired(&record) {
                        self.current_time()
                    } else {
                        record.expiration
                    };
                    record.expiration = base_time + (years as u64 * ONE_YEAR_MICROS);
                    self.state.domains.insert(&name, record).expect("Failed to extend domain");
                } else {
                    let message = Message::RequestExtend {
                        name,
                        owner,
                        years,
                        requester_chain: current_chain,
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
            Operation::Buy { name } => {
                if current_chain == registry_chain_id {
                    let mut record = self.state.domains.get(&name).await
                        .expect("Failed to read state")
                        .expect("Domain not registered");
                    
                    assert!(!self.is_expired(&record), "Domain has expired");
                    assert!(record.price > 0, "Domain is not for sale");
                    assert_ne!(record.owner, owner, "Cannot buy your own domain");
                    
                    // Transfer ownership
                    record.owner = owner;
                    record.owner_chain_id = current_chain;
                    record.price = 0; // Reset price after purchase
                    self.state.domains.insert(&name, record).expect("Failed to buy domain");
                } else {
                    let message = Message::RequestBuy {
                        name,
                        buyer: owner,
                        buyer_chain: current_chain,
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
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        let current_chain = self.runtime.chain_id();
        let registry_chain_id = self.registry_chain_id();
        let current_time = self.current_time();

        match message {
            Message::RequestRegister { name, owner, requester_chain } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process registrations");
                
                let existing = self.state.domains.get(&name).await.expect("Failed to read state");
                
                // Check if domain exists and is not expired
                if let Some(record) = existing {
                    if current_time <= record.expiration {
                        let response = Message::RegistrationFailed {
                            name,
                            reason: "Domain already registered and not expired".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                        return;
                    }
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
            Message::RequestExtend { name, owner, years, requester_chain } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process extensions");
                
                let stored = self.state.domains.get(&name).await.expect("Failed to read state");
                match stored {
                    None => {
                        let response = Message::ExtendFailed {
                            name,
                            reason: "Domain not registered".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(record) if record.owner != owner => {
                        let response = Message::ExtendFailed {
                            name,
                            reason: "Not the domain owner".to_string(),
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
            Message::RequestBuy { name, buyer, buyer_chain } => {
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process purchases");
                
                let stored = self.state.domains.get(&name).await.expect("Failed to read state");
                match stored {
                    None => {
                        let response = Message::BuyFailed {
                            name,
                            reason: "Domain not registered".to_string(),
                        };
                        self.runtime.send_message(buyer_chain, response);
                    }
                    Some(record) if current_time > record.expiration => {
                        let response = Message::BuyFailed {
                            name,
                            reason: "Domain has expired".to_string(),
                        };
                        self.runtime.send_message(buyer_chain, response);
                    }
                    Some(record) if record.price == 0 => {
                        let response = Message::BuyFailed {
                            name,
                            reason: "Domain is not for sale".to_string(),
                        };
                        self.runtime.send_message(buyer_chain, response);
                    }
                    Some(record) if record.owner == buyer => {
                        let response = Message::BuyFailed {
                            name,
                            reason: "Cannot buy your own domain".to_string(),
                        };
                        self.runtime.send_message(buyer_chain, response);
                    }
                    Some(mut record) => {
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
            // Response messages - just log them
            Message::RegistrationSuccess { name } => { let _ = name; }
            Message::RegistrationFailed { name, reason } => { let _ = (name, reason); }
            Message::TransferSuccess { name, new_owner } => { let _ = (name, new_owner); }
            Message::TransferFailed { name, reason } => { let _ = (name, reason); }
            Message::ExtendSuccess { name, new_expiration } => { let _ = (name, new_expiration); }
            Message::ExtendFailed { name, reason } => { let _ = (name, reason); }
            Message::SetPriceSuccess { name, price } => { let _ = (name, price); }
            Message::SetPriceFailed { name, reason } => { let _ = (name, reason); }
            Message::BuySuccess { name, new_owner } => { let _ = (name, new_owner); }
            Message::BuyFailed { name, reason } => { let _ = (name, reason); }
            Message::SetValueSuccess { name } => { let _ = name; }
            Message::SetValueFailed { name, reason } => { let _ = (name, reason); }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}
