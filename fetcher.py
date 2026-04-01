from urllib.parse import urlparse


def extract_domain_label(url: str) -> str:
    hostname = urlparse(url).hostname or ""
    if hostname.startswith("www."):
        hostname = hostname[4:]
    sld = hostname.split(".")[0]
    return sld.capitalize()
