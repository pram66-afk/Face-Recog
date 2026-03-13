from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
from datetime import datetime, timedelta
import ipaddress

# Local IP
IP_ADDR = "192.168.29.178"

key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
    backend=default_backend()
)

subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, u"IN"),
    x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"KA"),
    x509.NameAttribute(NameOID.LOCALITY_NAME, u"BLR"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"SMART-ATTENDANCE"),
    x509.NameAttribute(NameOID.COMMON_NAME, IP_ADDR),
])

cert = x509.CertificateBuilder().subject_name(
    subject
).issuer_name(
    issuer
).public_key(
    key.public_key()
).serial_number(
    x509.random_serial_number()
).not_valid_before(
    datetime.utcnow()
).not_valid_after(
    datetime.utcnow() + timedelta(days=365)
).add_extension(
    x509.SubjectAlternativeName([
        x509.DNSName(u"localhost"),
        x509.IPAddress(ipaddress.IPv4Address(IP_ADDR)),
    ]),
    critical=False,
).sign(key, hashes.SHA256(), default_backend())

with open("key.pem", "wb") as f:
    from cryptography.hazmat.primitives import serialization
    f.write(key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ))

with open("cert.pem", "wb") as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))

print("Certificates generated: cert.pem, key.pem")
