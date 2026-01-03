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
    async fn owner(&self, ctx: &async_graphql::Context<'_>, name: String) -> Option<String> {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        state.domains.get(&name).await.ok().flatten().map(|r| r.owner)
    }

    /// Check if a domain is available (not registered or expired).
    async fn is_available(&self, ctx: &async_graphql::Context<'_>, name: String) -> bool {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let current_time = runtime.system_time().micros();
        
        match state.domains.get(&name).await.ok().flatten() {
            None => true,
            Some(record) => current_time > record.expiration,
        }
    }

    /// Get full domain information
    async fn domain(&self, ctx: &async_graphql::Context<'_>, name: String) -> Option<DomainInfo> {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let current_time = runtime.system_time().micros();
        
        state.domains.get(&name).await.ok().flatten().map(|r| DomainInfo {
            name,
            owner: r.owner,
            owner_chain_id: r.owner_chain_id.to_string(),
            expiration: r.expiration,
            is_expired: current_time > r.expiration,
            price: r.price.to_string(),
            is_for_sale: r.price > 0,
            value: r.value,
        })
    }

    /// Resolve a domain name to its value (DNS-like lookup)
    async fn resolve(&self, ctx: &async_graphql::Context<'_>, name: String) -> Option<String> {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let current_time = runtime.system_time().micros();
        
        match state.domains.get(&name).await.ok().flatten() {
            Some(record) if current_time <= record.expiration => Some(record.value),
            _ => None,
        }
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

    /// List all registered domains (including expired ones).
    async fn all_domains(&self, ctx: &async_graphql::Context<'_>) -> Vec<DomainInfo> {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let current_time = runtime.system_time().micros();
        
        let mut domains = Vec::new();
        let _ = state.domains.for_each_index_value(|name, record| {
            domains.push(DomainInfo {
                name: name.clone(),
                owner: record.owner.clone(),
                owner_chain_id: record.owner_chain_id.to_string(),
                expiration: record.expiration,
                is_expired: current_time > record.expiration,
                price: record.price.to_string(),
                is_for_sale: record.price > 0,
                value: record.value.clone(),
            });
            Ok(())
        }).await;
        domains
    }

    /// List all domains that are for sale
    async fn domains_for_sale(&self, ctx: &async_graphql::Context<'_>) -> Vec<DomainInfo> {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let current_time = runtime.system_time().micros();
        
        let mut domains = Vec::new();
        let _ = state.domains.for_each_index_value(|name, record| {
            if record.price > 0 && current_time <= record.expiration {
                domains.push(DomainInfo {
                    name: name.clone(),
                    owner: record.owner.clone(),
                    owner_chain_id: record.owner_chain_id.to_string(),
                    expiration: record.expiration,
                    is_expired: false,
                    price: record.price.to_string(),
                    is_for_sale: true,
                    value: record.value.clone(),
                });
            }
            Ok(())
        }).await;
        domains
    }

    /// List domains owned by a specific address
    async fn domains_by_owner(&self, ctx: &async_graphql::Context<'_>, owner: String) -> Vec<DomainInfo> {
        let state = ctx.data_unchecked::<Arc<LineraNameSystemState>>();
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let current_time = runtime.system_time().micros();
        
        let mut domains = Vec::new();
        let _ = state.domains.for_each_index_value(|name, record| {
            if record.owner == owner {
                domains.push(DomainInfo {
                    name: name.clone(),
                    owner: record.owner.clone(),
                    owner_chain_id: record.owner_chain_id.to_string(),
                    expiration: record.expiration,
                    is_expired: current_time > record.expiration,
                    price: record.price.to_string(),
                    is_for_sale: record.price > 0,
                    value: record.value.clone(),
                });
            }
            Ok(())
        }).await;
        domains
    }
}

#[derive(async_graphql::SimpleObject)]
struct DomainInfo {
    name: String,
    owner: String,
    owner_chain_id: String,
    expiration: u64,
    is_expired: bool,
    price: String,
    is_for_sale: bool,
    value: String,
}

struct MutationRoot;

#[Object]
impl MutationRoot {
    /// Register a new .linera domain (1 year expiration by default)
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

    /// Extend domain registration by additional years (1-10)
    async fn extend(&self, ctx: &async_graphql::Context<'_>, name: String, years: i32) -> bool {
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let operation = Operation::Extend { name, years: years as u32 };
        runtime.schedule_operation(&operation);
        true
    }

    /// Set the price for selling the domain (use "0" to remove from sale)
    async fn set_price(&self, ctx: &async_graphql::Context<'_>, name: String, price: String) -> bool {
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let price_value: u128 = price.parse().unwrap_or(0);
        let operation = Operation::SetPrice { name, price: price_value };
        runtime.schedule_operation(&operation);
        true
    }

    /// Buy a domain that is for sale
    async fn buy(&self, ctx: &async_graphql::Context<'_>, name: String) -> bool {
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let operation = Operation::Buy { name };
        runtime.schedule_operation(&operation);
        true
    }

    /// Set the DNS-like value for a domain
    async fn set_value(&self, ctx: &async_graphql::Context<'_>, name: String, value: String) -> bool {
        let runtime = ctx.data_unchecked::<Arc<ServiceRuntime<LineraNameSystemService>>>();
        let operation = Operation::SetValue { name, value };
        runtime.schedule_operation(&operation);
        true
    }
}
