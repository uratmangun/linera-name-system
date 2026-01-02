use linera_sdk::views::{MapView, RootView, ViewStorageContext};

/// The application state storing domain registrations.
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct LineraNameSystemState {
    /// Map of domain names to owner addresses (global registry on registry chain)
    pub domains: MapView<String, String>,
}
