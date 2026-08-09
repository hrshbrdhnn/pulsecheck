import socket
import ssl
import hashlib
from datetime import datetime, timezone
from urllib.parse import urlparse
from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.x509.oid import ExtensionOID, AuthorityInformationAccessOID, NameOID
from cryptography.hazmat.backends import default_backend
import httpx

def get_fingerprint(cert: x509.Certificate) -> str:
    """Returns the SHA1 fingerprint of the certificate as a colon-separated hex string."""
    der_data = cert.public_bytes(serialization.Encoding.DER)
    sha1_digest = hashlib.sha1(der_data).digest()
    return ":".join(f"{b:02X}" for b in sha1_digest)

def parse_name(name: x509.Name) -> dict:
    """Extracts Common Name, Organization, and Country from a certificate subject or issuer."""
    res = {}
    try:
        cns = name.get_attributes_for_oid(NameOID.COMMON_NAME)
        if cns:
            res['CN'] = cns[0].value
    except Exception:
        pass
    try:
        orgs = name.get_attributes_for_oid(NameOID.ORGANIZATION_NAME)
        if orgs:
            res['O'] = orgs[0].value
    except Exception:
        pass
    try:
        countries = name.get_attributes_for_oid(NameOID.COUNTRY_NAME)
        if countries:
            res['C'] = countries[0].value
    except Exception:
        pass
    return res

def get_issuer_cert(cert: x509.Certificate) -> x509.Certificate:
    """Fetches the issuer certificate using the Authority Information Access (AIA) extension if available."""
    try:
        aia = cert.extensions.get_extension_for_oid(ExtensionOID.AUTHORITY_INFORMATION_ACCESS).value
        for access_description in aia:
            if access_description.access_method == AuthorityInformationAccessOID.CA_ISSUERS:
                url = access_description.access_location.value
                # Download issuer certificate in DER format
                with httpx.Client(verify=False) as client:
                    response = client.get(url, timeout=5)
                    if response.status_code == 200:
                        return x509.load_der_x509_certificate(response.content, default_backend())
    except Exception:
        pass
    return None
def format_name_to_str(name: x509.Name) -> str:
    """Formats an x509.Name subject/issuer to a readable string like 'CN - O (C)'."""
    attrs = parse_name(name)
    cn = attrs.get('CN')
    o = attrs.get('O')
    c = attrs.get('C')
    
    parts = []
    if cn:
        parts.append(cn)
    if o:
        parts.append(o)
    
    res = " - ".join(parts)
    if c:
        res = f"{res} ({c})"
    return res or "no info"

def parse_cert_to_dict(cert: x509.Certificate, tls_version: str = "TLSv1.3", signature_alg: str = "sha256WithRSAEncryption", depth: int = 0, max_depth: int = 4, target_host: str = None) -> dict:
    """Recursively parses a certificate and resolves its issuer chain, mapping it to a JS-compatible dict."""
    if depth >= max_depth:
        return None

    subject_str = format_name_to_str(cert.subject)
    issuer_str = format_name_to_str(cert.issuer)
    
    # Handle valid_to datetime
    try:
        valid_to = cert.not_valid_after_utc
    except AttributeError:
        valid_to = cert.not_valid_after.replace(tzinfo=timezone.utc)
        
    valid_to_str = valid_to.isoformat().split("T")[0]
    
    # Handle valid_from datetime
    try:
        valid_from = cert.not_valid_before_utc
    except AttributeError:
        valid_from = cert.not_valid_before.replace(tzinfo=timezone.utc)
        
    valid_from_str = valid_from.isoformat().split("T")[0]
    
    # Calculate days remaining
    now_utc = datetime.now(timezone.utc)
    days_remaining = (valid_to - now_utc).days
    
    fingerprint = get_fingerprint(cert)
    
    # Extract SANs
    san_list = []
    try:
        san_ext = cert.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME).value
        san_list = san_ext.get_values_for_type(x509.DNSName)
    except Exception:
        pass
        
    # Signature Algorithm
    try:
        sig_alg = cert.signature_algorithm_oid._name
    except Exception:
        sig_alg = signature_alg

    # Key size & type
    from cryptography.hazmat.primitives.asymmetric import rsa, ec
    try:
        pk = cert.public_key()
        if isinstance(pk, rsa.RSAPublicKey):
            key_size = f"{pk.key_size}-bit RSA"
        elif isinstance(pk, ec.EllipticCurvePublicKey):
            key_size = f"ECDSA {pk.curve.name}"
        else:
            key_size = "Unknown key type"
    except Exception:
        key_size = "2048-bit RSA"

    # Serial Number
    try:
        sn_hex = f"{cert.serial_number:X}"
        if len(sn_hex) % 2 != 0:
            sn_hex = "0" + sn_hex
        serial_number = ":".join(sn_hex[i:i+2] for i in range(0, len(sn_hex), 2))
    except Exception:
        serial_number = "Unknown"

    # SHA-256 fingerprint
    try:
        der_data = cert.public_bytes(serialization.Encoding.DER)
        sha256_digest = hashlib.sha256(der_data).digest()
        fingerprint_sha256 = ":".join(f"{b:02X}" for b in sha256_digest)
    except Exception:
        fingerprint_sha256 = None

    # Hostname matching check
    hostname_matched = False
    try:
        cns = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
        cn_val = cns[0].value.lower() if cns else ""
    except Exception:
        cn_val = ""

    if target_host:
        lower_host = target_host.lower()
        if lower_host == cn_val or lower_host in [s.lower() for s in san_list]:
            hostname_matched = True
        elif lower_host.startswith("www.") and (lower_host[4:] == cn_val or lower_host[4:] in [s.lower() for s in san_list]):
            hostname_matched = True
        else:
            # Check wildcard hosts like *.domain.com
            for san_entry in san_list:
                if san_entry.startswith("*."):
                    wildcard_domain = san_entry[2:].lower()
                    if lower_host.endswith(wildcard_domain) and lower_host.count(".") == wildcard_domain.count(".") + 1:
                        hostname_matched = True
                        break
        
    cert_info = {
        'subject': subject_str,
        'issuer': issuer_str,
        'validTo': valid_to_str,
        'validFrom': valid_from_str,
        'daysRemaining': days_remaining,
        'fingerprint': fingerprint,
        'tlsVersion': tls_version,
        'signatureAlgorithm': sig_alg,
        'san': san_list,
        'keySize': key_size,
        'serialNumber': serial_number,
        'fingerprintSha256': fingerprint_sha256,
        'hostnameMatched': hostname_matched
    }
    
    # Check if self-signed (subject == issuer)
    if cert.subject == cert.issuer:
        cert_info['certType'] = 'self-signed' if depth == 0 else 'root CA'
        cert_info['issuerCertificate'] = None
    else:
        cert_info['certType'] = 'server' if depth == 0 else 'intermediate CA'
        # Recursively resolve intermediate/root cert from issuer URL
        issuer_cert = get_issuer_cert(cert)
        if issuer_cert:
            cert_info['issuerCertificate'] = parse_cert_to_dict(issuer_cert, tls_version, sig_alg, depth + 1, max_depth, target_host)
        else:
            cert_info['issuerCertificate'] = None
            
    return cert_info

def fetch_tls_info(url: str, port: int = 443) -> dict:
    """Connects to the server on the specified port, fetches the TLS certificate, and returns it parsed."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or url
        if not hostname:
            raise ValueError("Invalid URL hostname")
            
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE  # accept expired/untrusted certs to report them
        
        with socket.create_connection((hostname, port), timeout=8) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                der_cert = ssock.getpeercert(binary_form=True)
                if not der_cert:
                    raise Exception("No certificate received from the server")
                    
                tls_version = ssock.version() or "TLSv1.3"
                cert = x509.load_der_x509_certificate(der_cert, default_backend())
                
                try:
                    sig_alg = cert.signature_algorithm_oid._name
                except Exception:
                    sig_alg = "sha256WithRSAEncryption"
                    
                cert_info = parse_cert_to_dict(cert, tls_version=tls_version, signature_alg=sig_alg, target_host=hostname)
                
                # Check socket status for general validation
                valid = True
                try:
                    # Double check if standard validation passes or fails
                    standard_context = ssl.create_default_context()
                    with socket.create_connection((hostname, port), timeout=5) as test_sock:
                        with standard_context.wrap_socket(test_sock, server_hostname=hostname) as _:
                            pass
                except Exception:
                    valid = False
                    
                return {
                    'valid': valid,
                    'certInfo': cert_info
                }
    except Exception as e:
        raise Exception(f"TLS Fetch Error: {str(e)}")
