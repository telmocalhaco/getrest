pub(crate) fn reserved_variable_name(name: &str) -> bool {
    ["__proto__", "constructor", "prototype"]
        .iter()
        .any(|reserved| name.eq_ignore_ascii_case(reserved))
}

pub(crate) fn valid_variable_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 100 || reserved_variable_name(name) {
        return false;
    }
    let mut characters = name.chars();
    let Some(first) = characters.next() else {
        return false;
    };
    (first.is_ascii_alphabetic() || first == '_')
        && characters.all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '.' | '-')
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_header_names_and_rejects_invalid_or_reserved_names() {
        for name in [
            "baseUrl",
            "X-Auth-Hash",
            "Content-Type",
            "Authorization",
            "_user",
            "item.id",
        ] {
            assert!(valid_variable_name(name), "{name} should be valid");
        }
        assert!(valid_variable_name(&"a".repeat(100)));
        assert!(!valid_variable_name(&"a".repeat(101)));
        for name in [
            "",
            "invalid name",
            "1name",
            "name\n",
            "{{name}}",
            "naïve",
            "__proto__",
            "constructor",
            "prototype",
            "Constructor",
            "PROTOTYPE",
            "__PROTO__",
        ] {
            assert!(!valid_variable_name(name), "{name} should be rejected");
        }
    }
}
