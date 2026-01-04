#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use linera_sdk::{
    linera_base_types::WithContractAbi,
    views::{RootView, View},
    Contract, ContractRuntime,
};

use domain_checker::{DomainQueryResult, Message, Operation};

use self::state::DomainCheckerState;

pub struct DomainCheckerContract {
    state: DomainCheckerState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(DomainCheckerContract);

impl WithContractAbi for DomainCheckerContract {
    type Abi = domain_checker::DomainCheckerAbi;
}

impl Contract for DomainCheckerContract {
    type Message = Message;
    type Parameters = ();
    type InstantiationArgument = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = DomainCheckerState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        DomainCheckerContract { state, runtime }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        // Nothing to initialize
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        let current_chain = self.runtime.chain_id();
        let current_time = self.runtime.system_time().micros();

        match operation {
            Operation::CheckOwnership { name, registry_chain_id } => {
                // Step 1: Send a CheckOwnership request to the LNS registry chain
                // Mark this query as pending
                self.state.pending_queries.insert(&name, current_time)
                    .expect("Failed to mark query as pending");

                // Send the request message to the registry chain
                let message = Message::RequestCheckOwnership {
                    name,
                    requester_chain: current_chain,
                };
                self.runtime.send_message(registry_chain_id, message);
            }
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        let current_time = self.runtime.system_time().micros();

        match message {
            Message::RequestCheckOwnership { name: _, requester_chain: _ } => {
                // This message should be handled by the LNS registry, not this contract
                // But we include it here for completeness - in practice, this contract
                // only sends RequestCheckOwnership, it doesn't receive it
                panic!("DomainChecker should not receive RequestCheckOwnership messages");
            }
            Message::OwnershipResponse { name, owner, is_available, expiration } => {
                // Step 3: Receive the response from the LNS registry
                // Store the result in our state
                let result = DomainQueryResult {
                    name: name.clone(),
                    owner,
                    is_available,
                    expiration,
                    query_timestamp: current_time,
                };

                // Remove from pending and store the result
                self.state.pending_queries.remove(&name)
                    .expect("Failed to remove pending query");
                self.state.domain_queries.insert(&name, result)
                    .expect("Failed to store query result");
            }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}
