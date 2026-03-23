import argparse

from app.utils.infrastructure import lookup_country_code_from_ip


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Look up a country code from an IP address using the configured MaxMind DB.",
    )
    parser.add_argument("ip", help="Public IP address to look up")
    args = parser.parse_args()

    country_code = lookup_country_code_from_ip(args.ip)
    if country_code is None:
        print("No country found for IP:", args.ip)
        return

    print(f"{args.ip} -> {country_code}")


if __name__ == "__main__":
    main()
