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
    /// Buy a domain that is for sale (requires sending payment)
    /// expected_price: The price the buyer expects to pay (from querying the registry)
    /// This prevents front-running attacks where the price changes between query and buy
    Buy { name: String, expected_price: u128 },
    /// Set the DNS-like value for a domain
    SetValue { name: String, value: String },
    /// Withdraw accumulated balance from domain sales
    Withdraw,
}

/// Cross-chain messages for the name system.
#[derive(Debug, Deserialize, Serialize)]
pub enum Message {
    /// Request to register a domain on the registry chain
    RequestRegister {
        name: String,
        owner: String,
        requester_chain: ChainId,
        /// The registration fee sent with this request (in attos)
        payment: u128,
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
        /// The extension fee sent with this request (in attos)
        payment: u128,
    },
    /// Request to set domain price
    RequestSetPrice {
        name: String,
        owner: String,
        price: u128,
        requester_chain: ChainId,
    },
    /// Request to buy a domain (includes payment amount for verification)
    RequestBuy {
        name: String,
        buyer: String,
        buyer_chain: ChainId,
        /// The payment amount sent with this request (in attos)
        payment: u128,
    },
    /// Request to set domain value
    RequestSetValue {
        name: String,
        owner: String,
        value: String,
        requester_chain: ChainId,
    },
    /// Request to withdraw accumulated balance
    RequestWithdraw {
        owner: String,
        requester_chain: ChainId,
    },
    /// Response: Registration successful
    RegistrationSuccess { name: String },
    /// Response: Registration failed (domain taken, includes refund info)
    RegistrationFailed {
        name: String,
        reason: String,
        refund_amount: u128,
    },
    /// Response: Transfer successful
    TransferSuccess { name: String, new_owner: String },
    /// Response: Transfer failed
    TransferFailed { name: String, reason: String },
    /// Response: Extension successful
    ExtendSuccess { name: String, new_expiration: u64 },
    /// Response: Extension failed (includes refund info)
    ExtendFailed {
        name: String,
        reason: String,
        refund_amount: u128,
    },
    /// Response: Set price successful
    SetPriceSuccess { name: String, price: u128 },
    /// Response: Set price failed
    SetPriceFailed { name: String, reason: String },
    /// Response: Buy successful
    BuySuccess { name: String, new_owner: String },
    /// Response: Buy failed (includes refund info)
    BuyFailed {
        name: String,
        reason: String,
        refund_amount: u128,
    },
    /// Response: Set value successful
    SetValueSuccess { name: String },
    /// Response: Set value failed
    SetValueFailed { name: String, reason: String },
    /// Response: Withdraw successful
    WithdrawSuccess { amount: u128 },
    /// Response: Withdraw failed
    WithdrawFailed { reason: String },
}
