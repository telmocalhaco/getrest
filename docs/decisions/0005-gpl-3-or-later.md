# ADR-0005: License GetRest under GPL-3.0-or-later

- Status: Accepted
- Date: 2026-07-21

## Context

GetRest is intended to remain open source and has no commercial objective. The project owner wants distributed modified versions to preserve the same source-code freedoms.

## Decision

License GetRest under the GNU General Public License version 3 or any later version, identified as `GPL-3.0-or-later`.

All dependencies and bundled assets must be checked for compatibility with this license before adoption.

## Consequences

- Anyone may use, study, modify, and distribute the application under the license terms.
- Distributed derivative works must provide corresponding source code under the same license.
- Commercial use remains permitted; the license protects software freedom rather than prohibiting commerce.
- Some proprietary or license-incompatible dependencies cannot be included.
- A future hosted service component may require a separate decision about whether AGPL protections are appropriate.

## Alternatives considered

- **MIT or Apache-2.0**: simpler permissive adoption, but allows distributed proprietary forks.
- **AGPL-3.0**: extends source-disclosure obligations to network use, which is not required for the current desktop-only architecture.
- **Non-commercial license**: conflicts with widely accepted definitions of open source.
