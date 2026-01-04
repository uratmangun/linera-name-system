use linera_sdk::linera_base_types::ChainId;
use linera_sdk::views::{MapView, RootView, ViewStorageContext};
use serde::{Deserialize, Serialize};

/// Domain registration information
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct DomainRecord {
    /// Owner address
    pub owner: String,
    /// Chain ID of the owner
    pub owner_chain_id: ChainId,
    /// Expiration timestamp (microseconds since epoch)
    pub expiration: u64,
    /// Price for sale (0 means not for sale)
    pub price: u128,
    /// DNS-like value (can be any text)
    pub value: String,
}

/// The application state storing domain registrations.
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct LineraNameSystemState {
    /// Map of domain names to domain records (global registry on registry chain)
    pub domains: MapView<String, DomainRecord>,
    /// Claimable balances for domain sellers (owner address -> amount in attos)
    /// Tokens are held in escrow on the registry chain until withdrawn
    pub balances: MapView<String, u128>,
}
