use async_graphql::{Request, Response};
use linera_sdk::abi::{ContractAbi, ServiceAbi};
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
    /// Register a new .linera domain
    Register { name: String },
    /// Transfer domain ownership
    Transfer { name: String, new_owner: String },
}
