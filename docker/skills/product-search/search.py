#!/usr/bin/env python3
"""
Thrift Product Search — Decodo Web Scraping Script
───────────────────────────────────────────────────
Searches multiple second-hand marketplaces for products matching a query.
Uses the Decodo Web Scraping API to bypass anti-bot protections and extract
structured product data.

Usage:
    python3 search.py --query "vintage Levi 501 jeans" --budget 75
    python3 search.py --query "herman miller aeron chair" --budget 500 --sites "ebay,craigslist"
"""

import argparse
import json
import os
import sys
import time
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

# ── Decodo API configuration ──
DECODO_API_URL = "https://scraper-api.decodo.com/v2/scrape"
DECODO_TOKEN = os.environ.get("DECODO_TOKEN", "")

# ── Marketplace search URL templates ──
# URLs optimized for relevance/best match (Original behavior)
MARKETPLACE_URLS_RELEVANCE = {
    "ebay": "https://www.ebay.com/sch/i.html?_nkw={query}&_sop=15&LH_BIN=1&_udhi={budget}",
    "depop": "https://www.depop.com/search/?q={query}&sort=relevance&priceMax={budget}",
    "poshmark": "https://poshmark.com/search?query={query}&max_price={budget}&availability=available",
    "etsy": "https://www.etsy.com/search?q={query}&max={budget}&explicit=1&ship_to=US",
    "craigslist": "https://www.craigslist.org/search/sss?query={query}&max_price={budget}&sort=rel",
    "facebook_marketplace": "https://www.facebook.com/marketplace/search/?query={query}&maxPrice={budget}&exact=false",
}

# URLs optimized for finding newly listed items (For Cron Notifications)
MARKETPLACE_URLS_NEW = {
    "ebay": "https://www.ebay.com/sch/i.html?_nkw={query}&_sop=10&LH_BIN=1&_udhi={budget}",
    "depop": "https://www.depop.com/search/?q={query}&sort=newlyListed&priceMax={budget}",
    "poshmark": "https://poshmark.com/search?query={query}&max_price={budget}&availability=available&sort_by=added_desc",
    "etsy": "https://www.etsy.com/search?q={query}&max={budget}&explicit=1&ship_to=US&order=date_desc",
    "craigslist": "https://www.craigslist.org/search/sss?query={query}&max_price={budget}&sort=date",
    "facebook_marketplace": "https://www.facebook.com/marketplace/search/?query={query}&maxPrice={budget}&exact=false&sortBy=creation_time_desc",
}

# ── CSS selectors for extracting product data from each marketplace ──
MARKETPLACE_SELECTORS = {
    "ebay": {
        "container": ".s-card",
        "name": ".s-card__title",
        "price": ".s-card__price",
        "url": "a.s-card__link",
        "image": "img.s-card__image",
        "condition": ".s-card__subtitle",
    },
    "depop": {
        "container": "[data-testid='product-card']",
        "name": "[data-testid='product-card'] p",
        "price": "[data-testid='product-card'] span",
        "url": "[data-testid='product-card'] a",
        "image": "[data-testid='product-card'] img",
        "condition": None,
    },
    "poshmark": {
        "container": ".card--small",
        "name": ".card__title",
        "price": ".card__price",
        "url": ".card__covershot a",
        "image": ".card__covershot img",
        "condition": None,
    },
    "etsy": {
        "container": ".wt-grid__item-xs-6",
        "name": ".v2-listing-card__info h3",
        "price": ".currency-value",
        "url": "a",
        "image": "img",
        "condition": None,
    },
    "craigslist": {
        "container": ".result-row",
        "name": ".result-title",
        "price": ".result-price",
        "url": ".result-title",
        "image": "img",
        "condition": None,
    },
    "facebook_marketplace": {
        "container": "[data-testid='marketplace-feed-item']",
        "name": "span",
        "price": "span",
        "url": "a",
        "image": "img",
        "condition": None,
    },
}


def scrape_marketplace(site: str, query: str, budget: float, sort_new: bool = False) -> list[dict]:
    """
    Scrape a single marketplace using the Decodo API.
    Returns a list of product dicts.
    """
    url_source = MARKETPLACE_URLS_NEW if sort_new else MARKETPLACE_URLS_RELEVANCE
    if site not in url_source:
        print(f"⚠ Unknown marketplace: {site}", file=sys.stderr)
        return []

    url_template = url_source[site]
    target_url = url_template.format(query=quote_plus(query), budget=int(budget))
    selectors = MARKETPLACE_SELECTORS.get(site, {})

    try:
        # Call Decodo's scraping API
        response = requests.post(
            DECODO_API_URL,
            headers={
                "Authorization": f"Basic {DECODO_TOKEN}"
            },
            json={
                "url": target_url,
                "target": "universal",
                "locale": "en-US",
                "geo": "United States",
                "device_type": "desktop",
                "headless": "html",
            },
            timeout=60,
        )

        if response.status_code == 401:
            print(f"✗ Decodo auth failed for {site} — check DECODO_TOKEN", file=sys.stderr)
            return []
        if response.status_code != 200:
            print(f"✗ Decodo returned {response.status_code} for {site}", file=sys.stderr)
            return []

        # Parse the returned HTML
        data = response.json()
        html_content = data.get("results", [{}])[0].get("content", "")
        if not html_content:
            print(f"⚠ No HTML returned for {site}", file=sys.stderr)
            return []

        soup = BeautifulSoup(html_content, "html.parser")
        container_sel = selectors.get("container", "")
        items = soup.select(container_sel)[:20]  # Limit to top 20

        products = []
        for item in items:
            try:
                # Extract product name
                name_el = item.select_one(selectors.get("name", ""))
                name = name_el.get_text(strip=True) if name_el else None
                if not name:
                    continue

                # Extract price
                price_el = item.select_one(selectors.get("price", ""))
                price_text = price_el.get_text(strip=True) if price_el else ""
                price = parse_price(price_text)

                # Extract URL
                url_el = item.select_one(selectors.get("url", ""))
                product_url = url_el.get("href", "") if url_el else ""
                if product_url and not product_url.startswith("http"):
                    # Resolve relative URLs
                    base_urls = {
                        "ebay": "https://www.ebay.com",
                        "depop": "https://www.depop.com",
                        "poshmark": "https://poshmark.com",
                        "etsy": "https://www.etsy.com",
                        "craigslist": "https://www.craigslist.org",
                        "facebook_marketplace": "https://www.facebook.com",
                    }
                    product_url = base_urls.get(site, "") + product_url

                # Extract image URL
                img_el = item.select_one(selectors.get("image", ""))
                image_url = ""
                if img_el:
                    image_url = img_el.get("src", "") or img_el.get("data-src", "")

                # Extract condition (if available)
                condition = None
                cond_sel = selectors.get("condition")
                if cond_sel:
                    cond_el = item.select_one(cond_sel)
                    condition = cond_el.get_text(strip=True) if cond_el else None

                products.append({
                    "name": name,
                    "price": price,
                    "source": format_source_name(site),
                    "url": product_url,
                    "imageUrl": image_url,
                    "condition": condition,
                })
            except Exception as e:
                # Skip items that fail to parse
                continue

        return products

    except requests.exceptions.Timeout:
        print(f"✗ Timeout scraping {site}", file=sys.stderr)
        return []
    except requests.exceptions.RequestException as e:
        print(f"✗ Error scraping {site}: {e}", file=sys.stderr)
        return []


def parse_price(price_text: str) -> float | None:
    """Extract a numeric price from text like '$45.99' or '£30'."""
    if not price_text:
        return None
    # Remove currency symbols and commas, take first number
    cleaned = ""
    for char in price_text:
        if char.isdigit() or char == ".":
            cleaned += char
        elif cleaned:
            break  # Stop at first non-numeric after digits
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def format_source_name(site: str) -> str:
    """Convert site key to display name."""
    return {
        "ebay": "eBay",
        "depop": "Depop",
        "poshmark": "Poshmark",
        "etsy": "Etsy",
        "craigslist": "Craigslist",
        "facebook_marketplace": "Facebook Marketplace",
    }.get(site, site.title())


def main():
    parser = argparse.ArgumentParser(description="Search for products across marketplaces")
    parser.add_argument("--query", required=True, help="Product search query")
    parser.add_argument("--budget", type=float, default=999999, help="Maximum price in USD")
    parser.add_argument(
        "--sites",
        default="ebay,depop,poshmark,etsy,craigslist",
        help="Comma-separated list of marketplaces to search",
    )
    parser.add_argument(
        "--sort-new",
        action="store_true",
        help="Sort results by newly listed (useful for cron jobs)",
    )
    args = parser.parse_args()

    sites = [s.strip() for s in args.sites.split(",")]

    # Validate credentials
    if not DECODO_TOKEN:
        print(
            json.dumps({
                "error": "Missing Decodo credentials. Set DECODO_TOKEN.",
                "query": args.query,
                "results": [],
            }),
        )
        sys.exit(1)

    all_results = []
    errors = []

    for site in sites:
        sort_mode_text = "newly listed" if args.sort_new else "relevance"
        print(f"⟳ Searching {format_source_name(site)} (by {sort_mode_text})...", file=sys.stderr)
        results = scrape_marketplace(site, args.query, args.budget, sort_new=args.sort_new)
        if results:
            all_results.extend(results)
            print(f"  ✓ Found {len(results)} results on {format_source_name(site)}", file=sys.stderr)
        else:
            errors.append(site)
            print(f"  ✗ No results from {format_source_name(site)}", file=sys.stderr)
        # Small delay between requests to be respectful
        time.sleep(0.5)

    # Filter by budget
    if args.budget < 999999:
        all_results = [r for r in all_results if r["price"] is None or r["price"] <= args.budget]

    # Sort by price (cheapest first), nulls last
    all_results.sort(key=lambda r: r["price"] if r["price"] is not None else float("inf"))

    # Output structured JSON
    output = {
        "query": args.query,
        "budget": args.budget if args.budget < 999999 else None,
        "resultCount": len(all_results),
        "sitesSearched": [format_source_name(s) for s in sites],
        "sitesWithErrors": [format_source_name(s) for s in errors],
        "results": all_results,
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
