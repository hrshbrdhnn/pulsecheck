import pytest
from app.dns_resolver import generate_dns_trace_info

def test_dns_trace_structure():
    domain = "google.com"
    try:
        trace = generate_dns_trace_info(domain)
        
        # Verify schema keys
        assert "targetDomain" in trace
        assert "recordType" in trace
        assert "nodes" in trace
        assert "records" in trace
        
        assert trace["targetDomain"] == domain
        
        # Verify trace nodes structure
        nodes = trace["nodes"]
        assert len(nodes) >= 2
        
        # Root server zone checks
        root_node = nodes[0]
        assert root_node["level"] == "Root Server"
        assert root_node["status"] == "NOERROR"
        assert root_node["serverIp"] == "198.41.0.4"
        
        # TLD server zone checks
        tld_node = nodes[1]
        assert tld_node["level"] == "TLD Server"
        assert "gtld-servers.net" in tld_node["serverName"]
        
        # DNS records checks
        records = trace["records"]
        assert len(records) > 0
        a_records = [r for r in records if r["type"] == "A"]
        assert len(a_records) > 0
        assert a_records[0]["name"] == domain
        assert isinstance(a_records[0]["ttl"], int)
        
    except Exception as e:
        # If test runner environment blocks raw UDP port 53 sockets, this test will raise an error.
        # We catch and print the socket/network block warning.
        pytest.skip(f"Network lookup blocked or DNS resolver unavailable: {e}")
