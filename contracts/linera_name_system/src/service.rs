#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use async_graphql::{EmptySubscription, Object, Request, Response, Schema};
use linera_sdk::{
    abi::WithServiceAbi,
    views::View,
    Service, ServiceRuntime,
};
use std::sync::Arc;

use linera_name_system::Operation;
use self::state::LineraNameSystemState;

pub struct LineraNameSystemService {
    state: Arc<LineraNameSystemState>,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(LineraNameSystemService);

impl WithServiceAbi for LineraNameSystemService {
    type Abi = linera_name_system::LineraNameSystemAbi;
}

impl Service for LineraNameSystemService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = LineraNameSystemState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        LineraNameSystemService { 
            state: Arc::new(state),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: Request) -> Response {
        let schema = Schema::build(QueryRoot, MutationRoot, EmptySubscription)
            .data(self.state.clone())
            .data(self.runtime.clone())
            .finish();
        schema.execute(request).await
    }
}

struct QueryRoot;

#[Object]
impl QueryRoot {
    /// Look up the owner of a domain from local state.
    /// NOTE: For authoritative data, query the registry chain directly.
    async fn owner(&self, ctx: &async_graphql::Context<'_>, name: String) -> Option<String> {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        state.domains.get(&name).await.ok().flatten()
    }

    /// Check if a domain is available from local state.
    /// NOTE: For authoritative data, query the registry chain directly.
    async fn is_available(&self, ctx: &async_graphql::Context<'_>, name: String) -> bool {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        state.domains.get(&name).await.ok().flatten().is_none()
    }

    /// Get the registry chain ID (the source of truth for all domains)
    async fn registry_chain_id(&self, ctx: &async_graphql::Context<'_>) -> String {
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        runtime.application_creator_chain_id().to_string()
    }

    /// Check if current chain is the registry chain
    async fn is_registry_chain(&self, ctx: &async_graphql::Context<'_>) -> bool {
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        runtime.chain_id() == runtime.application_creator_chain_id()
    }

    /// Get the current chain ID
    async fn current_chain_id(&self, ctx: &async_graphql::Context<'_>) -> String {
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        runtime.chain_id().to_string()
    }

    /// List all registered domains from local state.
    /// NOTE: For authoritative data, query the registry chain directly.
    async fn all_domains(&self, ctx: &async_graphql::Context<'_>) -> Vec<DomainInfo> {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        let mut domains = Vec::new();
        let _ = state.domains.for_each_index_value(|name, owner| {
            domains.push(DomainInfo {
                name: name.clone(),
                owner: owner.to_string(),
            });
            Ok(())
        }).await;
        domains
    }
}

#[derive(async_graphql::SimpleObject)]
struct DomainInfo {
    name: String,
    owner: String,
}

struct MutationRoot;

#[Object]
impl MutationRoot {
    /// Register a new .linera domain
    async fn register(&self, ctx: &async_graphql::Context<'_>, name: String) -> bool {
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let operation = Operation::Register { name };
        runtime.schedule_operation(&operation);
        true
    }

    /// Transfer domain ownership
    async fn transfer(&self, ctx: &async_graphql::Context<'_>, name: String, new_owner: String) -> bool {
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let operation = Operation::Transfer { name, new_owner };
        runtime.schedule_operation(&operation);
        true
    }
}
