# Formats

Validated conversion of external API-client exports into GetRest's typed import
model.

The current importer accepts JSON collection and environment exports from:

- Postman Collection v2/v2.1 and Postman environments;
- Hoppscotch REST collections and environments;
- Yaak workspace exports.

Nested folders are preserved as slash-separated collection names. Unsupported
HTTP methods and secret environment values are skipped and reported to the
user. Secret values are never written to the versioned environment files.
