//! Fetching one URL into one file, and checking a file's SHA-256.

use std::fmt;
use std::fs::File;
use std::io::{self, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use sha2::{Digest, Sha256};

/// Chunk size for both downloading and hashing: 1 MiB, so a big file is never held in memory.
pub(crate) const CHUNK: usize = 1024 * 1024;

/// Why a fetch ended without the file. `Display` is the one plain line shown to people.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DownloadError {
    /// The host couldn't be reached (DNS or connect). Holds the host name.
    Unreachable(String),
    /// The connection dropped or stalled part-way.
    Interrupted,
    /// The server answered with this HTTP status.
    Status(u16),
    DiskFull,
    /// The caller's cancel flag was set.
    Cancelled,
    /// Any other local file error.
    Io(String),
}

impl fmt::Display for DownloadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unreachable(host) => write!(f, "Couldn't reach {host}"),
            Self::Interrupted => f.write_str("Download interrupted"),
            Self::Status(code) => write!(f, "Server answered {code}"),
            Self::DiskFull => f.write_str("Disk full"),
            Self::Cancelled => f.write_str("Cancelled"),
            Self::Io(msg) => write!(f, "Couldn't write the file: {msg}"),
        }
    }
}

impl std::error::Error for DownloadError {}

impl From<io::Error> for DownloadError {
    fn from(e: io::Error) -> Self {
        // 28 is ENOSPC on Unix; StorageFull covers the platforms that map it.
        if e.kind() == io::ErrorKind::StorageFull || e.raw_os_error() == Some(28) {
            Self::DiskFull
        } else {
            Self::Io(e.to_string())
        }
    }
}

/// Gets bytes from a URL onto disk. The store is generic over this so tests never touch a network.
pub trait Downloader: Send + Sync {
    /// Fetch `url` into `dest`, calling `progress(bytes_so_far)` and stopping early when `cancel`
    /// is set (returning [`DownloadError::Cancelled`]). May leave a partial `dest` behind on error;
    /// the caller deletes it.
    fn fetch(
        &self,
        url: &str,
        dest: &Path,
        progress: &mut dyn FnMut(u64),
        cancel: &AtomicBool,
    ) -> Result<(), DownloadError>;
}

/// The default [`Downloader`]: a blocking `ureq` client with rustls. No retry, no resume.
pub struct UreqDownloader {
    agent: ureq::Agent,
}

impl UreqDownloader {
    pub fn new() -> Self {
        let config = ureq::Agent::config_builder()
            // The OS's TLS stack and trust store, not a bundled root list.
            .tls_config(
                ureq::tls::TlsConfig::builder()
                    .provider(ureq::tls::TlsProvider::NativeTls)
                    .root_certs(ureq::tls::RootCerts::PlatformVerifier)
                    .build(),
            )
            .timeout_resolve(Some(Duration::from_secs(15)))
            .timeout_connect(Some(Duration::from_secs(15)))
            // A stalled body ends as "Download interrupted" rather than hanging.
            .timeout_recv_body(Some(Duration::from_secs(30)))
            .build();
        Self {
            agent: ureq::Agent::new_with_config(config),
        }
    }
}

impl Default for UreqDownloader {
    fn default() -> Self {
        Self::new()
    }
}

/// The host part of a URL, for the "Couldn't reach" line.
fn host_of(url: &str) -> String {
    let rest = url.split_once("://").map_or(url, |(_, r)| r);
    rest.split(['/', '?', '#'])
        .next()
        .unwrap_or(rest)
        .to_string()
}

impl Downloader for UreqDownloader {
    fn fetch(
        &self,
        url: &str,
        dest: &Path,
        progress: &mut dyn FnMut(u64),
        cancel: &AtomicBool,
    ) -> Result<(), DownloadError> {
        let response = self.agent.get(url).call().map_err(|e| match e {
            ureq::Error::StatusCode(code) => DownloadError::Status(code),
            ureq::Error::HostNotFound | ureq::Error::ConnectionFailed => {
                DownloadError::Unreachable(host_of(url))
            }
            ureq::Error::Timeout(_) | ureq::Error::Io(_) => {
                DownloadError::Unreachable(host_of(url))
            }
            _ => DownloadError::Interrupted,
        })?;
        let mut body = response.into_body().into_reader();
        let mut out = File::create(dest)?;
        let mut buf = vec![0u8; CHUNK];
        let mut done = 0u64;
        loop {
            if cancel.load(Ordering::Relaxed) {
                return Err(DownloadError::Cancelled);
            }
            let n = body
                .read(&mut buf)
                .map_err(|_| DownloadError::Interrupted)?;
            if n == 0 {
                break;
            }
            out.write_all(&buf[..n])?;
            done += n as u64;
            progress(done);
        }
        out.flush()?;
        Ok(())
    }
}

/// Lower-case hex SHA-256 of a file, read in 1 MiB chunks.
pub(crate) fn sha256_file(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; CHUNK];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_is_pulled_from_the_url() {
        assert_eq!(
            host_of("https://huggingface.co/a/b.onnx?x=1"),
            "huggingface.co"
        );
        assert_eq!(host_of("http://localhost:8080/x"), "localhost:8080");
    }

    #[test]
    fn failure_lines_are_plain() {
        assert_eq!(
            DownloadError::Unreachable("huggingface.co".into()).to_string(),
            "Couldn't reach huggingface.co"
        );
        assert_eq!(
            DownloadError::Status(404).to_string(),
            "Server answered 404"
        );
        assert_eq!(
            DownloadError::Interrupted.to_string(),
            "Download interrupted"
        );
        assert_eq!(DownloadError::DiskFull.to_string(), "Disk full");
    }

    #[test]
    fn disk_full_is_recognised() {
        let e = io::Error::from_raw_os_error(28);
        assert_eq!(DownloadError::from(e), DownloadError::DiskFull);
    }

    #[test]
    fn sha256_of_known_bytes() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("f");
        std::fs::write(&p, b"abc").unwrap();
        assert_eq!(
            sha256_file(&p).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
