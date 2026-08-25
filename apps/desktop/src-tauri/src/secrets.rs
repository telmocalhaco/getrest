use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng, Payload},
    Aes256Gcm,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

const KEY_BYTES: usize = 32;
const NONCE_BYTES: usize = 12;
const KEYRING_SERVICE: &str = "org.getrest.workspace-encryption";

pub struct WorkspaceKey(Zeroizing<Vec<u8>>);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedValue {
    algorithm: String,
    nonce: String,
    ciphertext: String,
}

#[derive(Debug)]
pub struct SecretError {
    pub code: &'static str,
    pub message: &'static str,
}

impl SecretError {
    fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
}

impl WorkspaceKey {
    pub fn generate() -> Self {
        let key = Aes256Gcm::generate_key(OsRng);
        Self(Zeroizing::new(key.to_vec()))
    }

    pub fn from_bytes(bytes: Vec<u8>) -> Result<Self, SecretError> {
        if bytes.len() != KEY_BYTES {
            return Err(SecretError::new(
                "workspace_key_invalid",
                "The workspace encryption key is not valid.",
            ));
        }
        Ok(Self(Zeroizing::new(bytes)))
    }

    pub fn export_base64(&self) -> String {
        STANDARD.encode(self.0.as_slice())
    }

    pub fn import_base64(value: &str) -> Result<Self, SecretError> {
        let bytes = STANDARD.decode(value.trim()).map_err(|_| {
            SecretError::new(
                "workspace_key_invalid",
                "The workspace encryption key is not valid.",
            )
        })?;
        Self::from_bytes(bytes)
    }
}

pub fn load_workspace_key(workspace_id: &str) -> Result<WorkspaceKey, SecretError> {
    let entry = keyring_entry(workspace_id)?;
    let secret = entry.get_secret().map_err(|error| match error {
        keyring::Error::NoEntry => SecretError::new(
            "workspace_key_missing",
            "Import this workspace's encryption key to read its protected values.",
        ),
        _ => SecretError::new(
            "secure_storage_unavailable",
            "The operating-system credential store is unavailable.",
        ),
    })?;
    WorkspaceKey::from_bytes(secret)
}

pub fn load_or_create_workspace_key(workspace_id: &str) -> Result<WorkspaceKey, SecretError> {
    match load_workspace_key(workspace_id) {
        Ok(key) => Ok(key),
        Err(error) if error.code == "workspace_key_missing" => {
            let key = WorkspaceKey::generate();
            store_workspace_key(workspace_id, &key)?;
            Ok(key)
        }
        Err(error) => Err(error),
    }
}

pub fn store_workspace_key(workspace_id: &str, key: &WorkspaceKey) -> Result<(), SecretError> {
    keyring_entry(workspace_id)?
        .set_secret(key.0.as_slice())
        .map_err(|_| {
            SecretError::new(
                "secure_storage_unavailable",
                "The workspace encryption key could not be stored securely.",
            )
        })
}

pub fn delete_workspace_key(workspace_id: &str) {
    if let Ok(entry) = keyring_entry(workspace_id) {
        let _ = entry.delete_credential();
    }
}

pub fn encrypt_value(
    key: &WorkspaceKey,
    plaintext: &str,
    associated_data: &[u8],
) -> Result<EncryptedValue, SecretError> {
    let cipher = Aes256Gcm::new_from_slice(key.0.as_slice()).map_err(|_| crypto_error())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(
            &nonce,
            Payload {
                msg: plaintext.as_bytes(),
                aad: associated_data,
            },
        )
        .map_err(|_| crypto_error())?;
    Ok(EncryptedValue {
        algorithm: "AES-256-GCM".to_owned(),
        nonce: STANDARD.encode(nonce),
        ciphertext: STANDARD.encode(ciphertext),
    })
}

pub fn decrypt_value(
    key: &WorkspaceKey,
    encrypted: &EncryptedValue,
    associated_data: &[u8],
) -> Result<String, SecretError> {
    if encrypted.algorithm != "AES-256-GCM" {
        return Err(crypto_error());
    }
    let nonce = STANDARD
        .decode(&encrypted.nonce)
        .map_err(|_| crypto_error())?;
    let ciphertext = STANDARD
        .decode(&encrypted.ciphertext)
        .map_err(|_| crypto_error())?;
    if nonce.len() != NONCE_BYTES {
        return Err(crypto_error());
    }
    let cipher = Aes256Gcm::new_from_slice(key.0.as_slice()).map_err(|_| crypto_error())?;
    let plaintext = cipher
        .decrypt(
            nonce.as_slice().into(),
            Payload {
                msg: &ciphertext,
                aad: associated_data,
            },
        )
        .map_err(|_| crypto_error())?;
    String::from_utf8(plaintext).map_err(|_| crypto_error())
}

fn keyring_entry(workspace_id: &str) -> Result<keyring::Entry, SecretError> {
    keyring::Entry::new(KEYRING_SERVICE, workspace_id).map_err(|_| {
        SecretError::new(
            "secure_storage_unavailable",
            "The operating-system credential store is unavailable.",
        )
    })
}

fn crypto_error() -> SecretError {
    SecretError::new(
        "workspace_secret_unreadable",
        "A protected workspace value could not be decrypted with the available key.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypts_with_authenticated_context_and_round_trips() {
        let key = WorkspaceKey::from_bytes(vec![7; KEY_BYTES]).unwrap();
        let encrypted = encrypt_value(&key, "Bearer private", b"workspace:request:header").unwrap();

        assert_ne!(encrypted.ciphertext, "Bearer private");
        assert_eq!(
            decrypt_value(&key, &encrypted, b"workspace:request:header").unwrap(),
            "Bearer private"
        );
        assert!(decrypt_value(&key, &encrypted, b"different-context").is_err());
    }

    #[test]
    fn exports_and_imports_exactly_256_bit_keys() {
        let key = WorkspaceKey::from_bytes(vec![9; KEY_BYTES]).unwrap();
        let imported = WorkspaceKey::import_base64(&key.export_base64()).unwrap();
        assert_eq!(imported.export_base64(), key.export_base64());
        assert!(WorkspaceKey::import_base64("not-a-key").is_err());
    }
}
