//! What a model is: an id and the files that make it up.

/// One downloadable model: the files it is made of and what a person should be told about it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ModelSpec {
    /// Stable id, also the folder name under the models root.
    pub id: &'static str,
    /// Name shown to people.
    pub label: &'static str,
    /// Which tool needs it, in a few words.
    pub used_by: &'static str,
    /// Licence of the weights, as shown in the prompt.
    pub licence: &'static str,
    /// Host the files come from, as shown in the prompt (`huggingface.co`).
    pub host: &'static str,
    pub files: &'static [FileSpec],
}

impl ModelSpec {
    /// Total bytes of every file.
    pub fn total_size(&self) -> u64 {
        self.files.iter().map(|f| f.size).sum()
    }
}

/// One file of a model.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FileSpec {
    /// File name inside the model's folder.
    pub name: &'static str,
    pub url: &'static str,
    /// Lower-case hex SHA-256 of the finished file.
    pub sha256: &'static str,
    pub size: u64,
}
