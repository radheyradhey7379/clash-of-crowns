#[cfg(feature = "backend")]
pub mod benchmark;
pub mod handlers;
pub mod hce;
pub mod move_ordering;
pub mod negamax;
pub mod nnue;
pub mod pst;
pub mod quiescence;

#[cfg(feature = "backend")]
pub use handlers::eval_handler;
#[cfg(feature = "backend")]
pub use handlers::move_handler;
#[cfg(feature = "backend")]
pub use handlers::simulate_handler;
#[cfg(feature = "backend")]
pub use handlers::status_handler;
#[cfg(feature = "backend")]
pub use handlers::validate_handler;

#[cfg(all(test, feature = "backend"))]
mod tests;
