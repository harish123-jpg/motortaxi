
def iso2_to_flag(iso2: str) -> str:
    """Convert ISO 3166-1 alpha-2 code to a flag emoji (regional indicator symbols)."""
    return "".join(chr(127397 + ord(c)) for c in iso2.upper())


COUNTRY_CODES = [
    {"name": "Afghanistan", "iso2": "AF", "dial_code": "+93"},
    {"name": "Australia", "iso2": "AU", "dial_code": "+61"},
    {"name": "Bangladesh", "iso2": "BD", "dial_code": "+880"},
    {"name": "Belgium", "iso2": "BE", "dial_code": "+32"},
    {"name": "Bhutan", "iso2": "BT", "dial_code": "+975"},
    {"name": "Brazil", "iso2": "BR", "dial_code": "+55"},
    {"name": "Canada", "iso2": "CA", "dial_code": "+1"},
    {"name": "China", "iso2": "CN", "dial_code": "+86"},
    {"name": "Egypt", "iso2": "EG", "dial_code": "+20"},
    {"name": "France", "iso2": "FR", "dial_code": "+33"},
    {"name": "Germany", "iso2": "DE", "dial_code": "+49"},
    {"name": "Hong Kong", "iso2": "HK", "dial_code": "+852"},
    {"name": "India", "iso2": "IN", "dial_code": "+91"},
    {"name": "Indonesia", "iso2": "ID", "dial_code": "+62"},
    {"name": "Iran", "iso2": "IR", "dial_code": "+98"},
    {"name": "Iraq", "iso2": "IQ", "dial_code": "+964"},
    {"name": "Ireland", "iso2": "IE", "dial_code": "+353"},
    {"name": "Israel", "iso2": "IL", "dial_code": "+972"},
    {"name": "Italy", "iso2": "IT", "dial_code": "+39"},
    {"name": "Japan", "iso2": "JP", "dial_code": "+81"},
    {"name": "Kenya", "iso2": "KE", "dial_code": "+254"},
    {"name": "Kuwait", "iso2": "KW", "dial_code": "+965"},
    {"name": "Malaysia", "iso2": "MY", "dial_code": "+60"},
    {"name": "Maldives", "iso2": "MV", "dial_code": "+960"},
    {"name": "Mexico", "iso2": "MX", "dial_code": "+52"},
    {"name": "Myanmar", "iso2": "MM", "dial_code": "+95"},
    {"name": "Nepal", "iso2": "NP", "dial_code": "+977"},
    {"name": "Netherlands", "iso2": "NL", "dial_code": "+31"},
    {"name": "New Zealand", "iso2": "NZ", "dial_code": "+64"},
    {"name": "Nigeria", "iso2": "NG", "dial_code": "+234"},
    {"name": "Oman", "iso2": "OM", "dial_code": "+968"},
    {"name": "Pakistan", "iso2": "PK", "dial_code": "+92"},
    {"name": "Philippines", "iso2": "PH", "dial_code": "+63"},
    {"name": "Qatar", "iso2": "QA", "dial_code": "+974"},
    {"name": "Russia", "iso2": "RU", "dial_code": "+7"},
    {"name": "Saudi Arabia", "iso2": "SA", "dial_code": "+966"},
    {"name": "Singapore", "iso2": "SG", "dial_code": "+65"},
    {"name": "South Africa", "iso2": "ZA", "dial_code": "+27"},
    {"name": "South Korea", "iso2": "KR", "dial_code": "+82"},
    {"name": "Sri Lanka", "iso2": "LK", "dial_code": "+94"},
    {"name": "Sweden", "iso2": "SE", "dial_code": "+46"},
    {"name": "Switzerland", "iso2": "CH", "dial_code": "+41"},
    {"name": "Thailand", "iso2": "TH", "dial_code": "+66"},
    {"name": "Turkey", "iso2": "TR", "dial_code": "+90"},
    {"name": "United Arab Emirates", "iso2": "AE", "dial_code": "+971"},
    {"name": "United Kingdom", "iso2": "GB", "dial_code": "+44"},
    {"name": "United States", "iso2": "US", "dial_code": "+1"},
    {"name": "Vietnam", "iso2": "VN", "dial_code": "+84"},
]

COUNTRY_CODES = sorted(
    [
        {**c, "flag": iso2_to_flag(c["iso2"])}
        for c in COUNTRY_CODES
    ],
    key=lambda c: c["name"],
)