#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    abi::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use linera_name_system::{Message, Operation};
use self::state::LineraNameSystemState;

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
                    assert!(existing.is_none(), "Domain already registered");
                    self.state.domains.insert(&name, owner).expect("Failed to register domain");
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
                    let current_owner = self.state.domains.get(&name).await
                        .expect("Failed to read state")
                        .expect("Domain not registered");
                    assert_eq!(current_owner, owner, "Not the domain owner");
                    self.state.domains.insert(&name, new_owner).expect("Failed to transfer domain");
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
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        let current_chain = self.runtime.chain_id();
        let registry_chain_id = self.registry_chain_id();

        match message {
            Message::RequestRegister { name, owner, requester_chain } => {
                // Only the registry chain should process registration requests
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process registrations");
                
                let existing = self.state.domains.get(&name).await.expect("Failed to read state");
                if existing.is_some() {
                    // Domain already taken - send failure response
                    let response = Message::RegistrationFailed {
                        name,
                        reason: "Domain already registered".to_string(),
                    };
                    self.runtime.send_message(requester_chain, response);
                } else {
                    // Register the domain
                    self.state.domains.insert(&name, owner).expect("Failed to register domain");
                    let response = Message::RegistrationSuccess { name };
                    self.runtime.send_message(requester_chain, response);
                }
            }
            Message::RequestTransfer { name, new_owner, current_owner, requester_chain } => {
                // Only the registry chain should process transfer requests
                assert_eq!(current_chain, registry_chain_id, "Only registry chain can process transfers");
                
                let stored_owner = self.state.domains.get(&name).await.expect("Failed to read state");
                match stored_owner {
                    None => {
                        let response = Message::TransferFailed {
                            name,
                            reason: "Domain not registered".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(owner) if owner != current_owner => {
                        let response = Message::TransferFailed {
                            name,
                            reason: "Not the domain owner".to_string(),
                        };
                        self.runtime.send_message(requester_chain, response);
                    }
                    Some(_) => {
                        // Transfer ownership
                        self.state.domains.insert(&name, new_owner.clone()).expect("Failed to transfer domain");
                        let response = Message::TransferSuccess { name, new_owner };
                        self.runtime.send_message(requester_chain, response);
                    }
                }
            }
            Message::RegistrationSuccess { name } => {
                // Received confirmation that registration succeeded
                let _ = name;
            }
            Message::RegistrationFailed { name, reason } => {
                // Registration failed
                let _ = (name, reason);
            }
            Message::TransferSuccess { name, new_owner } => {
                // Transfer succeeded
                let _ = (name, new_owner);
            }
            Message::TransferFailed { name, reason } => {
                // Transfer failed
                let _ = (name, reason);
            }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}
