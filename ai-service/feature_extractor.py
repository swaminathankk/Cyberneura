"""
CyberNeura — URL Feature Extractor
===================================
Extracts 25 numerical features from a raw URL for ML classification.
All features are deterministic and require no external API calls,
making inference fast (<5ms per URL).

Feature Groups:
  - Lexical (10): length, entropy, char ratios, token counts
  - Domain (7):   subdomain depth, TLD risk, punycode, IP host, brand
  - Path/Query (5): slash count, query params, suspicious keywords
  - Protocol (3): http vs https, port presence, @ symbol
"""

import re
import math
import hashlib
from urllib.parse import urlparse, parse_qs
from typing import Dict, Any

try:
    import tldextract
    TLD_AVAILABLE = True
except ImportError:
    TLD_AVAILABLE = False

# ─── Constants ──────────────────────────────────────────────────────────────

HIGH_RISK_TLDS = {
    "tk", "ml", "ga", "cf", "gq", "xyz", "top", "club", "online", "site",
    "icu", "cyou", "monster", "fun", "space", "link", "work", "buzz",
    "click", "download", "zip", "mov", "gdn", "racing", "stream", "trade",
    "science", "party", "review", "accountant", "loan", "cricket",
}

TARGETED_BRANDS = [
    "paypal", "apple", "microsoft", "google", "amazon", "netflix", "facebook",
    "instagram", "twitter", "linkedin", "dropbox", "chase", "wellsfargo",
    "bankofamerica", "citibank", "irs", "fedex", "ups", "dhl", "ebay",
    "yahoo", "outlook", "office365", "onedrive", "steam", "coinbase",
]

SUSPICIOUS_KEYWORDS = [
    "login", "verify", "secure", "update", "account", "banking",
    "password", "confirm", "validation", "signin", "credential",
    "authenticate", "wallet", "recover", "suspended", "urgent",
    "alert", "billing", "invoice", "payment", "token", "reset",
]

# IPv4 pattern
IPV4_PATTERN = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")

# ─── Helper Functions ────────────────────────────────────────────────────────

def shannon_entropy(s: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not s:
        return 0.0
    freq: Dict[str, int] = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


def count_special_chars(s: str) -> int:
    return sum(1 for c in s if not c.isalnum() and c not in (".", "-", "_", "/", ":", "?", "&", "="))


def count_digits(s: str) -> int:
    return sum(1 for c in s if c.isdigit())


def is_ip_address(hostname: str) -> bool:
    return bool(IPV4_PATTERN.match(hostname))


def contains_punycode(s: str) -> bool:
    return "xn--" in s.lower()


# ─── Main Extractor ──────────────────────────────────────────────────────────

def extract_features(url: str) -> Dict[str, float]:
    """
    Extract 25 numerical features from a URL.

    Returns a dict with float values. All values are guaranteed
    to be finite numbers (no NaN / Inf).
    """
    features: Dict[str, float] = {}
    url = str(url).strip()

    # ── Parse URL ──────────────────────────────────────────────
    try:
        parsed = urlparse(url if "://" in url else f"http://{url}")
        hostname = parsed.hostname or ""
        path = parsed.path or ""
        query = parsed.query or ""
        scheme = parsed.scheme or ""
    except Exception:
        # Return zero-vector on parse failure
        return {f"f{i}": 0.0 for i in range(25)}

    full_url = url

    # ── TLD extraction ──────────────────────────────────────────
    if TLD_AVAILABLE:
        ext = tldextract.extract(url)
        domain = ext.domain or ""
        subdomain = ext.subdomain or ""
        tld = ext.suffix or ""
    else:
        parts = hostname.split(".")
        tld = parts[-1] if parts else ""
        domain = parts[-2] if len(parts) >= 2 else ""
        subdomain = ".".join(parts[:-2]) if len(parts) > 2 else ""

    # ── Feature 1: URL total length ────────────────────────────
    features["url_length"] = float(len(full_url))

    # ── Feature 2: Hostname length ─────────────────────────────
    features["hostname_length"] = float(len(hostname))

    # ── Feature 3: Path length ─────────────────────────────────
    features["path_length"] = float(len(path))

    # ── Feature 4: Query string length ────────────────────────
    features["query_length"] = float(len(query))

    # ── Feature 5: Shannon entropy of full URL ─────────────────
    features["url_entropy"] = shannon_entropy(full_url)

    # ── Feature 6: Shannon entropy of hostname ─────────────────
    features["hostname_entropy"] = shannon_entropy(hostname)

    # ── Feature 7: Number of dots in URL ──────────────────────
    features["dot_count"] = float(full_url.count("."))

    # ── Feature 8: Number of slashes ──────────────────────────
    features["slash_count"] = float(full_url.count("/"))

    # ── Feature 9: Number of hyphens in hostname ───────────────
    features["hyphen_count"] = float(hostname.count("-"))

    # ── Feature 10: Ratio of digits in URL ────────────────────
    features["digit_ratio"] = (
        count_digits(full_url) / len(full_url) if full_url else 0.0
    )

    # ── Feature 11: Ratio of special chars in URL ──────────────
    features["special_char_ratio"] = (
        count_special_chars(full_url) / len(full_url) if full_url else 0.0
    )

    # ── Feature 12: Subdomain depth ───────────────────────────
    features["subdomain_depth"] = float(len(subdomain.split(".")) if subdomain else 0)

    # ── Feature 13: Is IP address host ────────────────────────
    features["is_ip_host"] = float(is_ip_address(hostname))

    # ── Feature 14: Contains punycode (IDN homograph) ──────────
    features["has_punycode"] = float(contains_punycode(hostname))

    # ── Feature 15: High-risk TLD ──────────────────────────────
    features["high_risk_tld"] = float(tld.lower() in HIGH_RISK_TLDS)

    # ── Feature 16: Brand name appears in subdomain/path ───────
    url_lower = full_url.lower()
    brand_hit = any(
        brand in (subdomain + path + query).lower()
        for brand in TARGETED_BRANDS
    )
    # But if brand IS the actual domain, it's not suspicious
    if brand_hit:
        brand_is_domain = any(brand == domain.lower() for brand in TARGETED_BRANDS)
        brand_hit = brand_hit and not brand_is_domain
    features["brand_impersonation"] = float(brand_hit)

    # ── Feature 17: Suspicious keyword count ──────────────────
    features["suspicious_keyword_count"] = float(
        sum(1 for kw in SUSPICIOUS_KEYWORDS if kw in url_lower)
    )

    # ── Feature 18: Number of query parameters ────────────────
    try:
        params = parse_qs(query)
        features["query_param_count"] = float(len(params))
    except Exception:
        features["query_param_count"] = 0.0

    # ── Feature 19: Contains @ symbol (URL credential injection)
    features["has_at_symbol"] = float("@" in full_url)

    # ── Feature 20: Is HTTP (not HTTPS) ───────────────────────
    features["is_http"] = float(scheme == "http")

    # ── Feature 21: Has non-standard port ─────────────────────
    features["has_nonstandard_port"] = float(
        parsed.port is not None and parsed.port not in (80, 443, 8080, 8443)
    )

    # ── Feature 22: Double-slash in path (obfuscation) ────────
    features["has_double_slash"] = float("//" in path)

    # ── Feature 23: URL contains hex encoding ─────────────────
    features["has_hex_encoding"] = float("%" in full_url)

    # ── Feature 24: Token count in URL (word pieces) ──────────
    tokens = re.split(r"[.\-_/?=&:/]+", full_url)
    features["token_count"] = float(len([t for t in tokens if t]))

    # ── Feature 25: Longest token length ──────────────────────
    clean_tokens = [t for t in tokens if t]
    features["max_token_length"] = float(max((len(t) for t in clean_tokens), default=0))

    return features


def features_to_vector(features: Dict[str, float]) -> list:
    """Return features as a consistent-order list for model input."""
    FEATURE_ORDER = [
        "url_length", "hostname_length", "path_length", "query_length",
        "url_entropy", "hostname_entropy", "dot_count", "slash_count",
        "hyphen_count", "digit_ratio", "special_char_ratio",
        "subdomain_depth", "is_ip_host", "has_punycode", "high_risk_tld",
        "brand_impersonation", "suspicious_keyword_count", "query_param_count",
        "has_at_symbol", "is_http", "has_nonstandard_port", "has_double_slash",
        "has_hex_encoding", "token_count", "max_token_length",
    ]
    return [features.get(k, 0.0) for k in FEATURE_ORDER]


FEATURE_NAMES = [
    "url_length", "hostname_length", "path_length", "query_length",
    "url_entropy", "hostname_entropy", "dot_count", "slash_count",
    "hyphen_count", "digit_ratio", "special_char_ratio",
    "subdomain_depth", "is_ip_host", "has_punycode", "high_risk_tld",
    "brand_impersonation", "suspicious_keyword_count", "query_param_count",
    "has_at_symbol", "is_http", "has_nonstandard_port", "has_double_slash",
    "has_hex_encoding", "token_count", "max_token_length",
]
