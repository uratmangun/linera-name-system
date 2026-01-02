use async_graphql::{Request, Response};
use linera_sdk::abi::{ContractAbi, ServiceAbi};
use linera_sdk::linera_base_types::ChainId;
use serde::{Deserialize, Serialize};

pub struct LineraNameSystemAbi;

impl ContractAbi for LineraNameSystemAbi {
    type Operation = Operation;
    type Response = ();
}

impl ServiceAbi for LineraNameSystemAbi {
    type Query = Request;
    type QueryResponse = Response;
}

/// Operations that can be executed by the contract.
#[derive(Debug, Deserialize, Serialize)]
pub enum Operation {
    /// Register a new .linera domain (sends message to registry chain)
    Register { name: String },
    /// Transfer domain ownership (sends message to registry chain)
    Transfer { name: String, new_owner: String },
}

/// Cross-chain messages for the name system.
#[derive(Debug, Deserialize, Serialize)]
pub enum Message {
    /// Request to register a domain on the registry chain
    RequestRegister {
        name: String,
        owner: String,
        requester_chain: ChainId,
    },
    /// Request to transfer a domain on the registry chain
    RequestTransfer {
        name: String,
        new_owner: String,
        current_owner: String,
        requester_chain: ChainId,
    },
    /// Response: Registration successful
    RegistrationSuccess { name: String },
    /// Response: Registration failed (domain taken)
    RegistrationFailed { name: String, reason: String },
    /// Response: Transfer successful
    TransferSuccess { name: String, new_owner: String },
    /// Response: Transfer failed
    TransferFailed { name: String, reason: String },
}
