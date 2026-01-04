use async_graphql::{Request, Response};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::{ChainId, ContractAbi, ServiceAbi},
};
use serde::{Deserialize, Serialize};

pub struct DomainCheckerAbi;

impl ContractAbi for DomainCheckerAbi {
    type Operation = Operation;
    type Response = ();
}

impl ServiceAbi for DomainCheckerAbi {
    type Query = Request;
    type QueryResponse = Response;
}

/// Operations that can be executed by the domain checker contract
#[derive(Debug, Deserialize, Serialize, GraphQLMutationRoot)]
pub enum Operation {
    /// Check ownership of a domain by querying the LNS registry
    /// This sends a message to the registry chain and waits for a response
    CheckOwnership {
        name: String,
        /// The chain ID where the LNS registry is deployed
        registry_chain_id: ChainId,
    },
}

/// Messages for cross-chain communication
#[derive(Debug, Deserialize, Serialize)]
pub enum Message {
    /// Request sent to LNS registry to check domain ownership
    RequestCheckOwnership {
        name: String,
        requester_chain: ChainId,
    },
    /// Response from LNS registry with ownership info
    OwnershipResponse {
        name: String,
        owner: Option<String>,
        is_available: bool,
        expiration: Option<u64>,
    },
}

/// Domain query result stored in state
#[derive(Clone, Debug, Default, Deserialize, Serialize, async_graphql::SimpleObject)]
pub struct DomainQueryResult {
    pub name: String,
    pub owner: Option<String>,
    pub is_available: bool,
    pub expiration: Option<u64>,
    pub query_timestamp: u64,
}
