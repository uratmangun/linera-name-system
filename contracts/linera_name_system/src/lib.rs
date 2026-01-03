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
    /// Extend domain registration by additional years
    Extend { name: String, years: u32 },
    /// Set the price for selling the domain (0 = not for sale)
    SetPrice { name: String, price: u128 },
    /// Buy a domain that is for sale
    Buy { name: String },
    /// Set the DNS-like value for a domain
    SetValue { name: String, value: String },
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
    /// Request to extend domain registration
    RequestExtend {
        name: String,
        owner: String,
        years: u32,
        requester_chain: ChainId,
    },
    /// Request to set domain price
    RequestSetPrice {
        name: String,
        owner: String,
        price: u128,
        requester_chain: ChainId,
    },
    /// Request to buy a domain
    RequestBuy {
        name: String,
        buyer: String,
        buyer_chain: ChainId,
    },
    /// Request to set domain value
    RequestSetValue {
        name: String,
        owner: String,
        value: String,
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
    /// Response: Extension successful
    ExtendSuccess { name: String, new_expiration: u64 },
    /// Response: Extension failed
    ExtendFailed { name: String, reason: String },
    /// Response: Set price successful
    SetPriceSuccess { name: String, price: u128 },
    /// Response: Set price failed
    SetPriceFailed { name: String, reason: String },
    /// Response: Buy successful
    BuySuccess { name: String, new_owner: String },
    /// Response: Buy failed
    BuyFailed { name: String, reason: String },
    /// Response: Set value successful
    SetValueSuccess { name: String },
    /// Response: Set value failed
    SetValueFailed { name: String, reason: String },
}
