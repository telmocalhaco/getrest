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

Hoppscotch collections are identified before environments, including collections
with a `variables` field. Supported `<<variableName>>` references in request URLs,
bodies and header values are converted to GetRest's `{{variableName}}` syntax.
For environments, legacy `value` fields are preserved; otherwise a non-empty
`currentValue` takes precedence over `initialValue`. Empty current values fall
back to initial values when available, and variables with only empty values
remain empty. Secret and disabled variables are still excluded.

Yaak variable references such as `${[ baseUrl ]}` in request URLs, bodies, and
header values are converted to GetRest's `{{baseUrl}}` syntax. Only supported
variable names are converted; other expressions are left unchanged. Yaak
authentication is not imported, and each environment (including the base
environment) is imported independently without inheritance.
