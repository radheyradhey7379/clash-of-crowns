#[cfg(not(target_arch = "wasm32"))]
pub mod benchmark;
pub mod handlers;
pub mod hce;
pub mod move_ordering;
pub mod negamax;
pub mod nnue;
pub mod pst;
pub mod quiescence;

#[cfg(not(target_arch = "wasm32"))]
pub use handlers::eval_handler;
#[cfg(not(target_arch = "wasm32"))]
pub use handlers::move_handler;
#[cfg(not(target_arch = "wasm32"))]
pub use handlers::simulate_handler;
#[cfg(not(target_arch = "wasm32"))]
pub use handlers::status_handler;
#[cfg(not(target_arch = "wasm32"))]
pub use handlers::validate_handler;

#[cfg(test)]
mod tests;
