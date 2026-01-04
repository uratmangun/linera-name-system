#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Schema};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::WithServiceAbi,
    views::View,
    Service, ServiceRuntime,
};

use domain_checker::Operation;

use self::state::DomainCheckerState;

pub struct DomainCheckerService {
    state: Arc<DomainCheckerState>,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(DomainCheckerService);

impl WithServiceAbi for DomainCheckerService {
    type Abi = domain_checker::DomainCheckerAbi;
}

impl Service for DomainCheckerService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = DomainCheckerState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        DomainCheckerService {
            state: Arc::new(state),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Self::Query) -> Self::QueryResponse {
        Schema::build(
            QueryRoot {
                state: self.state.clone(),
                runtime: self.runtime.clone(),
            },
            Operation::mutation_root(self.runtime.clone()),
            EmptySubscription,
        )
        .finish()
        .execute(query)
        .await
    }
}

struct QueryRoot {
    state: Arc<DomainCheckerState>,
    runtime: Arc<ServiceRuntime<DomainCheckerService>>,
}

#[Object]
impl QueryRoot {
    /// Get the cached query result for a domain
    async fn domain_query(&self, name: String) -> Option<DomainQueryResultGql> {
        self.state.domain_queries.get(&name).await.ok().flatten().map(|r| DomainQueryResultGql {
            name: r.name,
            owner: r.owner,
            is_available: r.is_available,
            expiration: r.expiration,
            query_timestamp: r.query_timestamp,
        })
    }

    /// Check if a query is pending for a domain
    async fn is_query_pending(&self, name: String) -> bool {
        self.state.pending_queries.get(&name).await.ok().flatten().is_some()
    }

    /// Get the timestamp when a query was initiated (if pending)
    async fn pending_query_timestamp(&self, name: String) -> Option<u64> {
        self.state.pending_queries.get(&name).await.ok().flatten()
    }

    /// List all cached domain query results
    async fn all_cached_queries(&self) -> Vec<DomainQueryResultGql> {
        let mut results = Vec::new();
        let _ = self.state.domain_queries.for_each_index_value(|_name, record| {
            results.push(DomainQueryResultGql {
                name: record.name.clone(),
                owner: record.owner.clone(),
                is_available: record.is_available,
                expiration: record.expiration,
                query_timestamp: record.query_timestamp,
            });
            Ok(())
        }).await;
        results
    }

    /// Get the current chain ID
    async fn current_chain_id(&self) -> String {
        self.runtime.chain_id().to_string()
    }
}

/// GraphQL representation of domain query result
#[derive(async_graphql::SimpleObject)]
struct DomainQueryResultGql {
    name: String,
    owner: Option<String>,
    is_available: bool,
    expiration: Option<u64>,
    query_timestamp: u64,
}
