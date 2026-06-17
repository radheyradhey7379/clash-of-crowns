use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub host: String,
    #[allow(dead_code)]
    pub dev_mode: bool,
    pub allowed_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Self {
        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(3001);
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let dev_mode = env::var("DEV_MODE")
            .ok()
            .map(|val| val == "true" || val == "1")
            .unwrap_or(true);
        let allowed_origins = env::var("ALLOWED_ORIGINS")
            .ok()
            .map(|val| val.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_else(|| {
                vec![
                    "http://localhost:5173".to_string(),
                    "http://localhost:3000".to_string(),
                    "capacitor://localhost".to_string(),
                    "http://localhost".to_string(),
                ]
            });

        Self {
            port,
            host,
            dev_mode,
            allowed_origins,
        }
    }
}
