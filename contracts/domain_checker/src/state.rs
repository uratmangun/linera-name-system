use domain_checker::DomainQueryResult;
use linera_sdk::views::{linera_views, MapView, RootView, ViewStorageContext};

/// State for the domain checker contract
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct DomainCheckerState {
    /// Map of domain names to their query results
    /// Key: domain name, Value: query result from LNS registry
    pub domain_queries: MapView<String, DomainQueryResult>,
    /// Pending queries that are waiting for responses
    pub pending_queries: MapView<String, u64>, // domain name -> request timestamp
}
