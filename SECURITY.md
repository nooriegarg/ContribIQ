# Security Policy

## Supported Versions

Since ContribIQ is still in early development, we currently maintain security fixes only for the latest version.

| Version | Supported |
|---------|-----------|
| latest  | ✅ Yes     |
| older   | ❌ No      |

---

## Reporting a Vulnerability

If you find a security vulnerability in ContribIQ, **please do not open a public GitHub issue.**

Instead, report it privately by emailing the maintainers or using GitHub's private vulnerability reporting feature (Security tab → Report a vulnerability).

Please include:
- A description of the vulnerability
- Steps to reproduce it
- Potential impact
- Any suggested fix if you have one

We will acknowledge your report within **72 hours** and aim to release a fix within **14 days** depending on severity.

---

## What Counts as a Security Issue?

- Exposure of GitHub tokens or user credentials
- API responses leaking sensitive user data
- Dependency vulnerabilities with known CVEs
- Any behavior that could be exploited to access unauthorized data

---

## Scope

ContribIQ uses the GitHub API and only reads public repository data unless explicitly authorized by the user. We do not store any tokens or user data beyond the current session.

---

## Thank You

We appreciate responsible disclosure. Contributors who report valid security issues will be credited in the release notes (unless they prefer to remain anonymous).
