#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    abi::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use linera_name_system::Operation;
use self::state::LineraNameSystemState;

pub struct LineraNameSystemContract {
    state: LineraNameSystemState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(LineraNameSystemContract);

impl WithContractAbi for LineraNameSystemContract {
    type Abi = linera_name_system::LineraNameSystemAbi;
}

impl Contract for LineraNameSystemContract {
    type Message = ();
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
        // No initialization needed
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        let owner = self.runtime.authenticated_signer()
            .expect("Operation must be signed")
            .to_string();

        match operation {
            Operation::Register { name } => {
                // Validate domain name
                assert!(!name.is_empty(), "Domain name cannot be empty");
                assert!(name.len() <= 63, "Domain name too long");
                assert!(
                    name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'),
                    "Invalid characters in domain name"
                );

                // Check if domain is available
                let existing = self.state.domains.get(&name).await.expect("Failed to read state");
                assert!(existing.is_none(), "Domain already registered");

                // Register the domain
                self.state.domains.insert(&name, owner).expect("Failed to register domain");
            }
            Operation::Transfer { name, new_owner } => {
                // Check ownership
                let current_owner = self.state.domains.get(&name).await
                    .expect("Failed to read state")
                    .expect("Domain not registered");
                assert_eq!(current_owner, owner, "Not the domain owner");

                // Transfer ownership
                self.state.domains.insert(&name, new_owner).expect("Failed to transfer domain");
            }
        }
    }

    async fn execute_message(&mut self, _message: Self::Message) {
        // No cross-chain messages
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}
